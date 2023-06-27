import { ImageSize } from 'payload/dist/uploads/types';
import { CollectionConfig } from 'payload/types';
import sharp from 'sharp';
import { ResultObject } from './webp.interface';

export interface WebpPluginOptions {
  /**
   * Function that takes current image size to be resized and returns a sharp resize options object.
   * Can be used to modify particular image size sizing, cropping, fitting etc.
   * 
   * Example:
```JS
  resize: (imageSize) => {
      // fit to preserve aspect ratio if image size is xs
      if (imageSize.name === 'xs') {
        return {
          width: imageSize.width,
          height: imageSize.width,
          options: {
            fit: "inside"
          }
        }
      }
      // fallback to payload's default behavior
      return defaultResizeFactory(imageSize);
  }
```
   */
  resizeOptsFactory?: (imageSize: ImageSize) => {
    width: number;
    height: number;
    options?: sharp.ResizeOptions;
  };

  /**
   *  If present the main webp image will be sized to the given dimensions.
   */
  maxResizeOpts?: { width?: number; height?: number; options?: sharp.ResizeOptions };

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
   * By switching this flag the hook and following request response will await for the image conversion.
   */
  sync?: boolean;

  /**
   * When true log messages for debugging purposes.
   */
  debug?: boolean;

  /**
   * Filename conflict behavior.
   *
   * When ```true``` the existing files will be overwritten.
   *
   * When ```false``` ```+i``` will be added to the filename.
   *
   */
  overwrite?: boolean;

  /**
   * Default: When ```false``` EXIF metadata will be removed in the output.
   *
   * When ```true``` EXIF metadata will be kept in the output.
   *
   * _```orientation``` tag will be striped in either case as the image will be rotated based on its value during processing._
   */
  metadata?: boolean;

  /**
   * Hooks that will run at their specific location.   *
   */
  hooks?: {
    /**
     * This hook is run immediatelly after image conversion. The converted image files are in memory in ```bufferObject``` property.
     * You can use this hook to store the files in the cloud.
     */
    afterConversion?: (result: ResultObject) => any;
    /**
     * This hook is run immediatelly after storing files successfully. The converted image files are still in the memory in ```bufferObject``` property.
     * You can use this hook to run post-processing on the stored files.
     */
    afterStorage?: (result: ResultObject) => any;
  };
}
