import deepmerge from 'deepmerge';
import path from 'path';
import { Config } from 'payload/config';
import sharp from 'sharp';
import { WebpPluginOptions } from './config.interface';
import { Logger } from './logger';
import { fileExists } from './utils';
import WebpCollection from './WebpCollection';
import fs from 'fs';
import { File } from 'payload/dist/uploads/types';

export class WebpPlugin {
  logger: Logger;
  options: WebpPluginOptions;
  payloadConfig: Config;
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
  }

  async assertFilename(
    name: string,
    bufferObject: {
      data: Buffer;
      info: sharp.OutputInfo;
    },
    staticPath: string,
    i: number = 0
  ) {
    console.log('Aserting');
    const filename = `${name}-${bufferObject.info.width}x${bufferObject.info.height}${i > 0 ? '-' + i : ''}`;
    const filenameExt = `${filename}.webp`;

    const imagePath = `${staticPath}/${filenameExt}`;
    const fileAlreadyExists = await fileExists(imagePath);

    if (fileAlreadyExists) {
      if (!this.options.overwrite) {
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
      console.log('returning ok');
      return {
        filename,
        filenameExt,
        imagePath,
      };
    }
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
    const uploadCollections = this.options?.collections
      ? this.payloadConfig.collections.filter(
          (collection) => this.options.collections.includes(collection.slug) && !!collection.upload,
        )
      : this.payloadConfig.collections.filter((collection) => !!collection.upload);

    this.logger.log('upload collections found: ' + uploadCollections.map((col) => col.slug).join(', '));

    uploadCollections.forEach((collection) => WebpCollection(collection, this));
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
}
