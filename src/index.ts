import { Config } from "payload/config";

import merge from "deepmerge";
import path from "path";
import fs from "fs";

import { FileData, IncomingUploadType } from "payload/dist/uploads/types";
import { Field, CollectionConfig } from "payload/types";
import sharp from "sharp";
import { ErrorDeletingFile } from "payload/errors";
import { fileExists, getMetadata } from "./utils";
import getFileMetadataFields from "./getFileMetadataFields";
import {
  AfterChangeHook,
  AfterDeleteHook,
} from "payload/dist/collections/config/types";

interface webpPluginOptions {
  /**
   * Which mime types convert to webp.
   * Defaults to: ```["image/jpeg", "image/png", "image/webp"]```
   *
   * ***image/webp** is compressed*
   */
  mimeTypes?: string[];

  /**
   * sharp webp options
   * defaults to:
   * ```
   * {
   *    nearLossless: true,
   *    quality: 50,
   *    force: true,
   * }```
   */
  sharpWebpOptions?: sharp.WebpOptions;

  /**
   * Array of collection slugs that should have images converted to webp.
   * By default all collections with upload property will convert images to webp.
   */
  collections?: CollectionConfig["slug"][];
}

const webp =
  (pluginOptions?: webpPluginOptions) =>
  (config: Config): Config => {
    const sharpWebpOpts = pluginOptions?.sharpWebpOptions
      ? {
          force: true,
          ...pluginOptions.sharpWebpOptions,
        }
      : {
          nearLossless: true,
          quality: 50,
          force: true,
        };

    // mock plugin to avoid webpack errors in frontend
    config.admin.webpack = (config) => {
      config.resolve.alias[path.resolve(__dirname, "./webp")] = path.resolve(
        __dirname,
        "./mock-plugin"
      );
      return config;
    };

    const uploadCollections = pluginOptions?.collections
      ? config.collections.filter(
          (collection) =>
            pluginOptions.collections.includes(collection.slug) &&
            !!collection.upload
        )
      : config.collections.filter((collection) => !!collection.upload);

    uploadCollections.forEach((uploadCollection) => {
      const uploadOptions: IncomingUploadType =
        typeof uploadCollection.upload === "object"
          ? uploadCollection.upload
          : {};

      const webpFields: Field = {
        name: "webp",
        type: "group",
        admin: {
          readOnly: true,
          disabled: true,
        },
        fields: [
          ...getFileMetadataFields(({ data }) => {
            if (data?.webp?.filename) {
              return `${config.serverURL}${uploadOptions.staticURL}/${data.webp.filename}`;
            }

            return undefined;
          }),
          {
            name: "sizes",
            type: "group",
            fields: uploadOptions.imageSizes.map((size) => ({
              label: size.name,
              name: size.name,
              type: "group",
              admin: {
                disabled: true,
              },
              fields: [
                ...getFileMetadataFields(({ data }) => {
                  const sizeFilename = data?.sizes?.[size.name]?.filename;
                  if (sizeFilename) {
                    return `${config.serverURL}${uploadOptions.staticURL}/${sizeFilename}`;
                  }

                  return undefined;
                }),
              ],
            })),
            admin: {
              disabled: true,
            },
          },
        ],
      };
      uploadCollection.fields.push(webpFields);

      const afterChangeHook: AfterChangeHook = async (args) => {
        const payload = args.req.payload;
        let staticPath = uploadOptions.staticDir;

        if (uploadOptions.staticDir.indexOf("/") !== 0) {
          staticPath = path.resolve(
            payload.config.paths.configDir,
            uploadOptions.staticDir
          );
        }

        if (
          !(
            pluginOptions?.mimeTypes || [
              "image/jpeg",
              "image/png",
              "image/webp",
            ]
          ).includes(args.doc.mimeType)
        ) {
          return;
        }
        const { file } = args.req.files || {};
        const filename =
          args.doc.filename.substring(0, args.doc.filename.lastIndexOf(".")) ||
          args.doc.filename;

        if (
          args.doc.webp?.filename &&
          filename ===
            args.doc.webp.filename.substring(
              0,
              args.doc.filename.lastIndexOf(".")
            )
        ) {
          return;
        }

        if (file) {
          const converted = sharp(file.data).webp(sharpWebpOpts);
          const bufferObject = await converted.toBuffer({
            resolveWithObject: true,
          });
          const filenameExt = `${filename}.webp`;
          const imagePath = `${staticPath}/${filenameExt}`;
          const fileAlreadyExists = await fileExists(imagePath);

          if (fileAlreadyExists) {
            fs.unlinkSync(imagePath);
          }

          if (!uploadOptions.disableLocalStorage) {
            await converted.toFile(imagePath);
          }

          Object.assign(
            args.doc.webp,
            getMetadata(filenameExt, bufferObject.info)
          );
        }
        if (args?.req?.payloadUploadSizes) {
          for (const [key, value] of Object.entries(
            args.req.payloadUploadSizes
          )) {
            const converted = sharp(value).webp(sharpWebpOpts);
            const bufferObject = await converted.toBuffer({
              resolveWithObject: true,
            });

            const imageNameWithDimensions = `${filename}-${bufferObject.info.width}x${bufferObject.info.height}.webp`;
            const imagePath = `${staticPath}/${imageNameWithDimensions}`;
            const fileAlreadyExists = await fileExists(imagePath);

            if (fileAlreadyExists) {
              fs.unlinkSync(imagePath);
            }

            if (!uploadOptions.disableLocalStorage) {
              await converted.toFile(imagePath);
            }

            args.doc.webp.sizes[key] = getMetadata(
              imageNameWithDimensions,
              bufferObject.info
            );
          }
        }

        payload
          .update({
            collection: uploadCollection.slug,
            data: args.doc,
            id: args.doc.id,
          })
          .then();
        return args.doc;
      };

      const afterDeleteHook: AfterDeleteHook = async ({ req, id, doc }) => {
        if (uploadCollection.upload && doc.webp?.filename) {
          const staticPath = path.resolve(
            req.payload.config.paths.configDir,
            uploadOptions.staticDir
          );

          const fileToDelete = `${staticPath}/${doc.webp.filename}`;

          if (await fileExists(fileToDelete)) {
            fs.unlink(fileToDelete, (err) => {
              if (err) {
                throw new ErrorDeletingFile();
              }
            });
          }

          if (doc.webp.sizes) {
            Object.values(doc.webp.sizes).forEach(async (size: FileData) => {
              const sizeToDelete = `${staticPath}/${size.filename}`;
              if (await fileExists(sizeToDelete)) {
                fs.unlink(sizeToDelete, (err) => {
                  if (err) {
                    throw new ErrorDeletingFile();
                  }
                });
              }
            });
          }
        }
      };

      if (!uploadCollection.hooks) {
        uploadCollection.hooks = {};
      }
      uploadCollection.hooks = merge(uploadCollection.hooks, {
        afterChange: [afterChangeHook],
        afterDelete: [afterDeleteHook],
      });
    });

    return config;
  };

export default webp;
