import path from 'path';
import { Payload } from 'payload';
import { FileData, IncomingUploadType } from 'payload/dist/uploads/types';
import { ErrorDeletingFile } from 'payload/errors';
import { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, Field } from 'payload/types';
import getFileMetadataFields, { ImageFields } from './getFileMetadataFields';
import { WebpPlugin } from './Plugin';
import { afterReadUrlHookAction, fileExists } from './utils';
import fs from 'fs';
import deepmerge from 'deepmerge';
import { PayloadRequest } from 'payload/dist/express/types';

export default (collection: CollectionConfig, plugin: WebpPlugin) => {
  collection.upload = typeof collection.upload === 'object' ? collection.upload : ({} as IncomingUploadType);

  const webpFields: Field = {
    name: 'webp',
    type: 'group',
    admin: {
      readOnly: true,
      disabled: true,
    },
    fields: [
      ...getFileMetadataFields(({ data }) =>
        afterReadUrlHookAction(
          data?.webp?.filename,
          (collection.upload as IncomingUploadType).staticURL || collection.slug,
          plugin.payloadConfig.serverURL,
        ),
      ),
    ],
  };

  if (collection.upload?.imageSizes && Array.isArray(collection.upload.imageSizes)) {
    plugin.logger.log(
      `found image sizes of upload collection "${collection.slug}": ${collection.upload.imageSizes
        .map((imageSize) => imageSize.name)
        .join(', ')}`,
    );

    webpFields.fields.push({
      name: 'sizes',
      type: 'group',
      fields:
        collection.upload?.imageSizes?.map((size) => ({
          label: size.name,
          name: size.name,
          type: 'group',
          admin: {
            disabled: true,
          },
          fields: [
            ...getFileMetadataFields(
              ({ data }) =>
                afterReadUrlHookAction(
                  data?.webp?.sizes?.[size.name]?.filename,
                  (collection.upload as IncomingUploadType).staticURL || collection.slug,
                  plugin.payloadConfig.serverURL,
                ),
            ),
          ],
        })) || [],
      admin: {
        disabled: true,
      },
    });
  }
  collection.fields.push(webpFields);

  // TODO: stop conversion when media gets deleted in meantime
  const convertImages = async <
    T extends ImageFields & {
      id: string | number;
      webp: ImageFields & { sizes: { [key: string]: ImageFields } };
    } = any,
  >(args: {
    doc: T;
    req: PayloadRequest;
  }) => {
    const payload: Payload = args.req.payload;
    let staticPath = (collection.upload as IncomingUploadType).staticDir;

    if ((collection.upload as IncomingUploadType).staticDir.indexOf('/') !== 0) {
      staticPath = path.resolve(payload.config.paths.configDir, (collection.upload as IncomingUploadType).staticDir);
    }

    if (!(plugin.options?.mimeTypes || ['image/jpeg', 'image/png', 'image/webp']).includes(args.doc.mimeType)) {
      return;
    }
    const { file } = args.req.files || {};

    if (file) {
      plugin.makeWebp(file, staticPath, collection, args.doc.id, args.req.payload, args.req);
    }

    return args.doc;
  };

  /**
   * --------------------------------------------------------------------------------------------------------------------
   * ---------------------------   HOOKS   ------------------------------------------------------------------------------
   * --------------------------------------------------------------------------------------------------------------------
   */

  const afterChangeHook: CollectionAfterChangeHook = async (args) => {
    if (!args.req.payloadUploadSizes) {
      return args.doc;
    }
    if (plugin.options?.sync) {
      plugin.logger.log(`starting SYNC conversion`);
      return await convertImages(args);
    } else {
      plugin.logger.log(`starting ASYNC conversion`);

      convertImages(args);
      return args.doc;
    }
  };

  const afterDeleteHook: CollectionAfterDeleteHook = async ({ req, id, doc }) => {
    if (collection.upload && doc.webp?.filename) {
      const staticPath = path.resolve(
        req.payload.config.paths.configDir,
        (collection.upload as IncomingUploadType).staticDir,
      );

      const fileToDelete = path.resolve(staticPath, doc.webp.filename);

      plugin.logger.log(`attempting to delete image: ${fileToDelete}`);

      if (await fileExists(fileToDelete)) {
        fs.unlink(fileToDelete, (err) => {
          if (err) {
            throw new ErrorDeletingFile();
          }
        });
      }

      if (doc.webp.sizes) {
        Object.values(doc.webp.sizes).forEach(async (size: FileData) => {
          const sizeToDelete = path.resolve(staticPath, size.filename);
          plugin.logger.log(`attempting to delete image size file: ${fileToDelete}`);

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

  if (!collection.hooks) {
    collection.hooks = {};
  }
  collection.hooks = deepmerge(collection.hooks, {
    afterChange: [afterChangeHook],
    afterDelete: [afterDeleteHook],
  });
};
