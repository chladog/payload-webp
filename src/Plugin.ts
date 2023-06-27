import deepmerge from 'deepmerge';
import path from 'path';
import { Config } from 'payload/config';
import sharp from 'sharp';
import { WebpPluginOptions } from './config.interface';
import { Logger } from './logger';
import { executeAccess, fileExists, getMetadata } from './utils';
import WebpCollection from './WebpCollection';
import fs from 'fs';
import { File, IncomingUploadType } from 'payload/dist/uploads/types';
import { Payload } from 'payload';
import { CollectionConfig } from 'payload/types';
import { Collection } from 'payload/dist/collections/config/types';
import { PayloadRequest } from 'payload/dist/express/types';
import { APIError } from 'payload/errors';
import GraphQL from 'graphql';
import { BufferObject, ResultObject } from './webp.interface';

export class WebpPlugin {
  logger: Logger;
  options: WebpPluginOptions;
  payloadConfig: Config;
  uploadCollections: any;
  regenerating = new Map();
  get config() {
    return this.payloadConfig;
  }
  constructor(payloadConfig: Config, options: WebpPluginOptions) {
    // duplicate config
    this.payloadConfig = deepmerge({}, payloadConfig);
    this.logger = new Logger(options?.debug || false);

    this.options = options || {};
    this.options.sharpWebpOptions = options?.sharpWebpOptions
      ? options.sharpWebpOptions
      : {
          quality: 50,
        };

    this.webpackAlias();

    this.uploadCollectionsLookup();
    this.regenerateResolver();
  }

  async assertFilename(
    name: string,
    bufferObject: {
      data: Buffer;
      info: sharp.OutputInfo;
    },
    staticPath: string,
    i: number = 0,
  ) {
    const filename = `${name}${i > 0 ? '-' + i : ''}-${bufferObject.info.width}x${bufferObject.info.height}`;
    const filenameExt = `${filename}.webp`;

    const imagePath = `${staticPath}/${filenameExt}`;
    const fileAlreadyExists = await fileExists(imagePath);

    if (fileAlreadyExists) {
      if (this.options.overwrite) {
        return new Promise((resolve) =>
          fs.unlink(imagePath, (err) => {
            if (err) this.logger.err(err.message);

            this.logger.log(imagePath + ' was deleted');
            resolve({
              filename,
              filenameExt,
              imagePath,
            });
          }),
        );
      }
      return this.assertFilename(name, bufferObject, staticPath, i + 1);
    } else {
      return {
        filename,
        filenameExt,
        imagePath,
      };
    }
  }

  async makeWebp(
    file: File,
    staticPath: string,
    collectionConfig: CollectionConfig,
    docId: string | number,
    payload: Payload,
    req: PayloadRequest,
  ): Promise<any> {
    let newFiledata: any = {};
    this.logger.log(`converting image`);

    const converted = await this.convert(
      file,
      staticPath,
      this.options.maxResizeOpts,
      (collectionConfig.upload as IncomingUploadType).disableLocalStorage,
    );

    if (!converted) {
      return;
    }
    newFiledata = {
      webp: getMetadata(converted.filenameExt, converted.bufferObject.info),
    };
    req.payloadWebp = {
      src: converted.bufferObject.data,
    };
    newFiledata.webp.sizes = {};

    if ((collectionConfig.upload as IncomingUploadType).imageSizes) {
      for (const size of (collectionConfig.upload as IncomingUploadType).imageSizes) {
        this.logger.log(`converting image size: ${size.name}`);
        const convertedSize = await this.convert(
          file,
          staticPath,
          this.options.resizeOptsFactory
            ? this.options.resizeOptsFactory(size)
            : { width: size.width, height: size.height, options: { position: size.crop || 'centre' } },
          (collectionConfig.upload as IncomingUploadType).disableLocalStorage,
        );
        if (convertedSize) {
          newFiledata.webp.sizes[size.name] = getMetadata(convertedSize.filenameExt, convertedSize.bufferObject.info);
          req.payloadWebp[size.name] = convertedSize.bufferObject.data;
        }
      }
    }

    this.logger.log(`updating collection: ${collectionConfig.slug}, id: ${docId}`);
    try {
      await payload.update({
        locale: req.locale,
        fallbackLocale: req.fallbackLocale,
        collection: collectionConfig.slug,
        data: newFiledata,
        id: docId,
        depth: 0,
      });
      return newFiledata;
    } catch (e) {
      this.logger.err(e.message);
      return;
    }
  }

  async convert(
    file: File,
    staticPath: string,
    resize?: { width?: number; height?: number; options?: sharp.ResizeOptions },
    disableLocalStorage = false,
  ): Promise<ResultObject | null> {
    const converted = sharp(file.data);

    converted.rotate();

    if (this.options.metadata === true) {
      converted.withMetadata();
    }

    if (resize) {
      converted.resize(resize.width, resize.height, resize.options);
    }
    converted.webp(this.options.sharpWebpOptions);
    let bufferObject: BufferObject | null;
    try {
      bufferObject = await converted.toBuffer({
        resolveWithObject: true,
      });
    } catch (e) {
      this.logger.err(e.message);
      bufferObject = null;
    }

    if (!bufferObject) {
      return null;
    }

    const name = file.name.substring(0, file.name.lastIndexOf('.'));

    const { filename, filenameExt, imagePath } = await this.assertFilename(name, bufferObject, staticPath);

    this.logger.log(`converted image: ${filenameExt}`);

    const resultObj: ResultObject = {
      originalFile: file,
      name,
      bufferObject,
      filename,
      filenameExt,
    };

    if (this.options.hooks?.afterConversion) {
      this.options.hooks.afterConversion(resultObj);
    }

    if (!disableLocalStorage) {
      try {
        await converted.toFile(imagePath);
        this.logger.log(`saving image: ${imagePath}`);
        if (this.options.hooks?.afterStorage) {
          this.options.hooks.afterStorage(resultObj);
        }
        return resultObj;
      } catch (e) {
        this.logger.err(e.message);
        return null;
      }
    }

    return resultObj;
  }

  uploadCollectionsLookup() {
    this.uploadCollections = this.options?.collections
      ? this.payloadConfig.collections.filter(
          (collection) => this.options.collections.includes(collection.slug) && !!collection.upload,
        )
      : this.payloadConfig.collections.filter((collection) => !!collection.upload);

    this.logger.log('upload collections found: ' + this.uploadCollections.map((col) => col.slug).join(', '));

    this.uploadCollections.forEach((collection) => WebpCollection(collection, this));
  }

  webpackAlias() {
    if (!this.payloadConfig.admin) {
      this.payloadConfig.admin = {};
    }
    const incomingWebpackConfig = this.payloadConfig?.admin?.webpack;
    // mock plugin to avoid webpack errors in frontend
    this.payloadConfig.admin.webpack = (webpackConfig) => {
      webpackConfig.resolve.alias['payload-webp'] = path.resolve(__dirname, './mock-plugin');
      // call incoming webpack function as well
      return incomingWebpackConfig ? incomingWebpackConfig(webpackConfig) : webpackConfig;
    };
  }

  async regenerateImage(
    incoming: string | { id: string; mimeType: string; filename: string; filesize: string },
    payload: Payload,
    collectionConfig: CollectionConfig,
    req: PayloadRequest,
  ) {
    const data =
      typeof incoming === 'object'
        ? incoming
        : await payload.findByID({
            id: incoming,
            locale: req.locale,
            fallbackLocale: req.fallbackLocale,
            collection: collectionConfig.slug,
            depth: 0,
          });

    // REGENERATE
    const staticPath = path.resolve(
      payload.config.paths.configDir,
      (collectionConfig.upload as IncomingUploadType).staticDir,
    );
    const originalFilePath = path.resolve(staticPath, data.filename);

    return await new Promise((resolve) =>
      fs.readFile(originalFilePath, null, async (err, buffer) => {
        if (err) {
          this.logger.err('Error while trying to read original file: ' + data.filename + '; ' + err.message);
          return resolve(false);
        }
        await this.makeWebp(
          {
            data: buffer,
            mimetype: data.mimeType,
            name: data.filename,
            size: data.filesize,
          },
          staticPath,
          collectionConfig,
          data.id,
          payload,
          req,
        );
        return resolve(true);
      }),
    );
  }

  async regenerateCollectionLoop(
    collectionSlug: string,
    payload: Payload,
    current: number,
    req: PayloadRequest,
    sort?: string,
  ) {
    try {
      const find = await payload.find({
        locale: req.locale,
        fallbackLocale: req.fallbackLocale,
        collection: collectionSlug,
        sort: sort || 'createdAt',
        pagination: true,
        page: current,
        depth: 0,
        limit: 1,
      });
      const data = find.docs[0];
      const status = {
        currentFile: find.docs[0].filename,
        current: find.page,
        total: find.totalPages,
      };
      this.regenerating.set(collectionSlug, status);
      const collectionConfig: CollectionConfig = this.uploadCollections.find((item) => item.slug === collectionSlug);

      // REGENERATE
      await this.regenerateImage(data, payload, collectionConfig, req);

      // LOOP
      if (status.current < status.total) {
        if (current <= 1 || this.options.sync) {
          this.regenerateCollectionLoop(collectionSlug, payload, current + 1, req, sort);
        } else {
          await this.regenerateCollectionLoop(collectionSlug, payload, current + 1, req, sort);
        }
      } else {
        this.regenerating.delete(collectionSlug);
        this.logger.log('Finished regenerating ' + collectionSlug);
      }
      return status;
    } catch (e) {
      throw new APIError(e.message, 500);
    }
  }

  regenerateResolver() {
    const incomingMutationsF = this.payloadConfig?.graphQL?.mutations
      ? this.payloadConfig.graphQL.mutations
      : undefined;
    const newMutations = (gql: typeof GraphQL, payload: Payload) => {
      let incomingMutations = {};
      if (incomingMutationsF) {
        incomingMutations = incomingMutationsF(gql, payload);
      }

      const collectionSlugType = new gql.GraphQLEnumType({
        name: 'CollectionSlug',
        values: Object.assign(
          {},
          ...this.uploadCollections.map((collection) => ({
            [collection.slug.replace(/-./g, (x) => x[1].toUpperCase())]: { value: collection.slug },
          })),
        ),
      });
      return {
        ...incomingMutations,
        WebpRegenerate: {
          args: {
            slug: {
              type: new gql.GraphQLNonNull(collectionSlugType),
            },
            sort: {
              type: gql.GraphQLString,
            },
          },
          resolve: async (root, args, context) => {
            const collections: Collection[] = Object.values(context.req.payload.collections);
            const collection = collections.find((item) => item?.config?.slug === args.slug);
            if (args.slug && (await executeAccess({ req: context.req }, collection.config.access.update))) {
              if (!this.regenerating.get(args.slug)) {
                this.logger.log('Starting regeneration for ' + args.slug);
                try {
                  return await this.regenerateCollectionLoop(args.slug, context.req.payload, 1, context.req, args.sort);
                } catch (e) {
                  throw new APIError(e.message, 500);
                }
              } else {
                this.logger.log(
                  'Regeneration in progress for ' +
                    args.slug +
                    ': ' +
                    this.regenerating.get(args.slug).current +
                    '/' +
                    this.regenerating.get(args.slug).total,
                );
                return this.regenerating.get(args.slug);
              }
            } else {
              throw new Error('Access denied');
            }
          },
          type: new gql.GraphQLObjectType({
            name: 'WebpRegenerateStatus',
            fields: {
              currentFile: { type: gql.GraphQLString },
              current: { type: gql.GraphQLInt },
              total: { type: gql.GraphQLInt },
            },
          }),
        },

        WebpRegenerateSingle: {
          args: {
            slug: {
              type: new gql.GraphQLNonNull(collectionSlugType),
            },
            id: {
              type: new gql.GraphQLNonNull(gql.GraphQLString),
            },
          },

          resolve: async (root, args, context) => {
            const collections: Collection[] = Object.values(context.req.payload.collections);
            const collection = collections.find((item) => item?.config?.slug === args.slug);
            if (args.slug && (await executeAccess({ req: context.req }, collection.config.access.update))) {
              this.logger.log('Starting regeneration for ' + args.slug + '/' + args.id);
              try {
                return await this.regenerateImage(args.id, context.req.payload, collection.config, context.req);
              } catch (e) {
                throw new APIError(e.message, 500);
              }
            } else {
              throw new Error('Access denied');
            }
          },
          type: gql.GraphQLBoolean,
        },
      };
    };
    if (!this.payloadConfig.graphQL) {
      this.payloadConfig.graphQL = {};
    }
    Object.assign(this.payloadConfig.graphQL, { mutations: newMutations });
  }
}
