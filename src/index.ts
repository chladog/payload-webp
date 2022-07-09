import { Config } from 'payload/config';

import merge from 'deepmerge';
import path from 'path';
import fs from 'fs';

import { FileData, IncomingUploadType } from 'payload/dist/uploads/types';
import { Field, CollectionConfig, CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload/types';
import sharp from 'sharp';
import { ErrorDeletingFile } from 'payload/errors';
import { fileExists, getMetadata } from './utils';
import getFileMetadataFields from './getFileMetadataFields';
import deepmerge from 'deepmerge';
import chalk from 'chalk';
import { Payload } from 'payload';

export interface WebpPluginOptions {
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
  collections?: CollectionConfig['slug'][];

  /**
   * By default image conversion happens asynchronously in the background for faster UX.
   * By switching this flag hook and following request response will await for the image conversion.
   */
  sync?: boolean;

  /**
   * When true log messages for debugging purposes.
   */
  debug?: boolean;
}

const log = (message: string) => {
  return console.log(chalk.inverse.bold('payload-webp-plugin:') + chalk(' ' + message));
};

const webp =
  (pluginOptions?: WebpPluginOptions) =>
  (incomingConfig: Config): Config => {
    // duplicate config
    const config = deepmerge({}, incomingConfig);
    const debug = incomingConfig.debug || false;

    const sharpWebpOpts = pluginOptions?.sharpWebpOptions
      ? pluginOptions.sharpWebpOptions
      : {
          quality: 50,
        };

    console.log(sharpWebpOpts);
    if (!config.admin) {
      config.admin = {};
    }
    // mock plugin to avoid webpack errors in frontend
    config.admin.webpack = (webpackConfig) => {
      webpackConfig.resolve.alias['payload-webp'] = path.resolve(__dirname, './mock-plugin');
      // call incoming webpack function as well
      return incomingConfig.admin?.webpack ? incomingConfig.admin.webpack(webpackConfig) : webpackConfig;
    };

    const uploadCollections = pluginOptions?.collections
      ? config.collections.filter(
          (collection) => pluginOptions.collections.includes(collection.slug) && !!collection.upload,
        )
      : config.collections.filter((collection) => !!collection.upload);

    if (debug) {
      log('upload collections found: ' + uploadCollections.map((col) => col.slug).join(', '));
    }

    uploadCollections.forEach((uploadCollection) => {
      const uploadOptions: IncomingUploadType =
        typeof uploadCollection.upload === 'object' ? uploadCollection.upload : {};

      const webpFields: Field = {
        name: 'webp',
        type: 'group',
        admin: {
          readOnly: true,
          disabled: true,
        },
        fields: [
          ...getFileMetadataFields(({ data }) => {
            if (data?.webp?.filename) {
              return `${config.serverURL || ''}${uploadOptions.staticURL}/${data.webp.filename}`;
            }

            return undefined;
          }),
        ],
      };

      if (uploadOptions?.imageSizes && Array.isArray(uploadOptions.imageSizes)) {
        if (debug) {
          log(
            `found image sizes of upload collection "${uploadCollection.slug}": ${uploadOptions.imageSizes
              .map((imageSize) => imageSize.name)
              .join(', ')}`,
          );
        }
        webpFields.fields.push({
          name: 'sizes',
          type: 'group',
          fields:
            uploadOptions?.imageSizes?.map((size) => ({
              label: size.name,
              name: size.name,
              type: 'group',
              admin: {
                disabled: true,
              },
              fields: [
                ...getFileMetadataFields(({ data }) => {
                  const sizeFilename = data?.webp?.sizes?.[size.name]?.filename;
                  if (sizeFilename) {
                    return `${config.serverURL || ''}${uploadOptions.staticURL}/${sizeFilename}`;
                  }

                  return undefined;
                }),
              ],
            })) || [],
          admin: {
            disabled: true,
          },
        });
      }
      uploadCollection.fields.push(webpFields);

      // TODO: stop conversion when media gets deleted in meantime
      const convertImages = async (args) => {
        let data: any;
        const payload: Payload = args.req.payload;
        let staticPath = uploadOptions.staticDir;

        if (uploadOptions.staticDir.indexOf('/') !== 0) {
          staticPath = path.resolve(payload.config.paths.configDir, uploadOptions.staticDir);
        }

        if (!(pluginOptions?.mimeTypes || ['image/jpeg', 'image/png', 'image/webp']).includes(args.doc.mimeType)) {
          return;
        }
        const { file } = args.req.files || {};
        const filename = args.doc.filename.substring(0, args.doc.filename.lastIndexOf('.')) || args.doc.filename;

        if (
          args.doc.webp?.filename &&
          filename === args.doc.webp.filename.substring(0, args.doc.filename.lastIndexOf('.'))
        ) {
          return;
        }

        if (file) {
          if (debug) {
            log(`converting image`);
          }
          const converted = sharp(file.data).webp(sharpWebpOpts);
          const bufferObject = await converted.toBuffer({
            resolveWithObject: true,
          });
          const filenameExt = `${filename}.webp`;
          const imagePath = `${staticPath}/${filenameExt}`;
          const fileAlreadyExists = await fileExists(imagePath);

          if (debug) {
            log(`converted image: ${filenameExt}`);
          }
          if (fileAlreadyExists) {
            fs.unlink(imagePath, (err) => {
              if (err) log(err.message);
              log(imagePath + ' was deleted');
            });
          }

          if (!uploadOptions.disableLocalStorage) {
            await converted.toFile(imagePath);
            if (debug) {
              log(`saving image: ${imagePath}`);
            }
          }

          data = {
            webp: getMetadata(filenameExt, bufferObject.info),
          };
          data.webp.sizes = {};
        }
        if (args?.req?.payloadUploadSizes) {
          for (const [key, value] of Object.entries(args.req.payloadUploadSizes)) {
            if (debug) {
              log(`converting image size: ${key}`);
            }
            const converted = sharp(value).toFormat('webp').webp(sharpWebpOpts);
            const bufferObject = await converted.toBuffer({
              resolveWithObject: true,
            });

            const imageNameWithDimensions = `${filename}-${bufferObject.info.width}x${bufferObject.info.height}.webp`;
            if (debug) {
              log(`converted image size: ${imageNameWithDimensions}`);
            }
            const imagePath = `${staticPath}/${imageNameWithDimensions}`;
            const fileAlreadyExists = await fileExists(imagePath);

            if (fileAlreadyExists) {
              fs.unlink(imagePath, (err) => {
                if (err) log(err.message);
                log(imagePath + ' was deleted');
              });
            }

            if (!uploadOptions.disableLocalStorage) {
              if (debug) {
                log(`saving image size: ${imagePath}`);
              }
              await converted.toFile(imagePath);
            }
            data.webp.sizes[key] = getMetadata(imageNameWithDimensions, bufferObject.info);
          }
        }

        if (debug) {
          log(`updating collection: ${uploadCollection.slug}, id: ${args.doc.id}`);
        }
        payload.findByID({ id: args.doc.id, collection: uploadCollection.slug }).then(() => {
          payload
            .update({
              collection: uploadCollection.slug,
              data,
              id: args.doc.id,
            })
            .then();
        });
        return args.doc;
      };

      const afterChangeHook: CollectionAfterChangeHook = async (args) => {
        if (!args.req.payloadUploadSizes) {
          return args.doc;
        }
        if (pluginOptions?.sync) {
          if (debug) {
            log(`starting SYNC conversion`);
          }
          return await convertImages(args);
        } else {
          if (debug) {
            log(`starting ASYNC conversion`);
          }
          convertImages(args);
          return args.doc;
        }
      };

      const afterDeleteHook: CollectionAfterDeleteHook = async ({ req, id, doc }) => {
        if (uploadCollection.upload && doc.webp?.filename) {
          const staticPath = path.resolve(req.payload.config.paths.configDir, uploadOptions.staticDir);

          const fileToDelete = `${staticPath}/${doc.webp.filename}`;

          if (debug) {
            log(`attempting to delete image: ${fileToDelete}`);
          }

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
              if (debug) {
                log(`attempting to delete image size file: ${fileToDelete}`);
              }
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
