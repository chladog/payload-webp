import deepmerge from 'deepmerge';
import path from 'path';
import { Config } from 'payload/config';
import sharp from 'sharp';
import { WebpPluginOptions } from './config.interface';
import { Logger } from './logger';
import { fileExists, getMetadata } from './utils';
import WebpCollection from './WebpCollection';
import fs from 'fs';
import { File, IncomingUploadType } from 'payload/dist/uploads/types';
import { Payload } from 'payload';
import { PayloadRequest } from 'payload/dist/express/types';
import { CollectionConfig } from 'payload/types';

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
    this.logger = new Logger(options.debug || false);

    this.options = options;
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
  ): Promise<any> {
    let newFiledata: any = {};
    this.logger.log(`converting image`);

    const { filenameExt, bufferObject } = await this.convert(
      file,
      staticPath,
      this.options.maxResizeOpts,
      (collectionConfig.upload as IncomingUploadType).disableLocalStorage,
    );

    if (!bufferObject) {
      return;
    }
    newFiledata = {
      webp: getMetadata(filenameExt, bufferObject.info),
    };
    newFiledata.webp.sizes = {};

    if ((collectionConfig.upload as IncomingUploadType).imageSizes) {
      for (const size of (collectionConfig.upload as IncomingUploadType).imageSizes) {
        this.logger.log(`converting image size: ${size.name}`);
        const { filename } = await this.convert(
          file,
          staticPath,
          this.options.resizeOptsFactory
            ? this.options.resizeOptsFactory(size)
            : { width: size.width, height: size.height, options: { position: size.crop || 'centre' } },
          (collectionConfig.upload as IncomingUploadType).disableLocalStorage,
        );
        newFiledata.webp.sizes[size.name] = getMetadata(filename, bufferObject.info);
      }
    }

    this.logger.log(`updating collection: ${collectionConfig.slug}, id: ${docId}`);
    await payload.update({
      collection: collectionConfig.slug,
      data: newFiledata,
      id: docId,
    });
    return newFiledata;
  }

  async convert(
    file: File,
    staticPath: string,
    resize?: { width?: number; height?: number; options?: sharp.ResizeOptions },
    disableLocalStorage = false,
  ) {
    const converted = sharp(file.data);
    if (resize) {
      converted.resize(resize.width, resize.height, resize.options);
    }
    converted.webp(this.options.sharpWebpOptions).withMetadata();
    const bufferObject = await converted.toBuffer({
      resolveWithObject: true,
    });
    const name = file.name.substring(0, file.name.lastIndexOf('.'));

    const { filename, filenameExt, imagePath } = await this.assertFilename(name, bufferObject, staticPath);

    this.logger.log(`converted image: ${filenameExt}`);

    if (!disableLocalStorage) {
      await converted.toFile(imagePath);
      this.logger.log(`saving image: ${imagePath}`);
    }

    return {
      originalFile: file,
      name,
      bufferObject,
      filename,
      filenameExt,
    };
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
    const incomingWebpackConfig = this.payloadConfig.admin.webpack;
    if (!this.payloadConfig.admin) {
      this.payloadConfig.admin = {};
    }
    // mock plugin to avoid webpack errors in frontend
    this.payloadConfig.admin.webpack = (webpackConfig) => {
      webpackConfig.resolve.alias['payload-webp'] = path.resolve(__dirname, './mock-plugin');
      // call incoming webpack function as well
      return incomingWebpackConfig ? incomingWebpackConfig(webpackConfig) : webpackConfig;
    };
  }

  async regenerateCollectionLoop(
    collectionSlug: string,
    payload: Payload,
    current: number,
    req: PayloadRequest,
    sort?: string,
  ) {
    const find = await payload.find({
      collection: collectionSlug,
      sort: sort || 'createdAt',
      pagination: true,
      page: current,
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
    let newFiledata: any;
    const staticPath = path.resolve(
      req.payload.config.paths.configDir,
      (collectionConfig.upload as IncomingUploadType).staticDir,
    );
    const originalFilePath = path.resolve(staticPath, data.filename);

    await new Promise((resolve) =>
      fs.readFile(originalFilePath, null, async (err, buffer) => {
        if (err) {
          this.logger.err('Error while trying to read original file: ' + data.filename + '; ' + err.message);
          return resolve(status);
        }
        const { filename, filenameExt, bufferObject } = await this.makeWebp(
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
        );
        return resolve(status);
      }),
    );

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
  }

  regenerateResolver() {
    this.payloadConfig.graphQL.mutations = (GraphQL, payload) => {
      return {
        WebpRegenerate: {
          args: {
            slug: {
              type: new GraphQL.GraphQLEnumType({
                name: 'CollectionSlug',
                values: Object.assign(
                  {},
                  ...this.uploadCollections.map((collection) => ({
                    [collection.slug.replace(/-./g, (x) => x[1].toUpperCase())]: { value: collection.slug },
                  })),
                ),
              }),
            },
            sort: {
              type: GraphQL.GraphQLString,
            },
          },

          resolve: async (root, args, context) => {
            console.log(this.regenerating.get(args.slug));
            if (!this.regenerating.get(args.slug)) {
              this.logger.log('Starting regeneration for ' + args.slug);
              return await this.regenerateCollectionLoop(args.slug, payload, 1, context.req, args.sort);
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
          },
          type: new GraphQL.GraphQLObjectType({
            name: 'WebpRegenerateStatus',
            fields: {
              currentFile: { type: GraphQL.GraphQLString },
              current: { type: GraphQL.GraphQLInt },
              total: { type: GraphQL.GraphQLInt },
            },
          }),
        },
      };
    };
  }
}