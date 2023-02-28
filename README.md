# payload-webp

**payloadcms/payload** plugin for automatic image conversion to **webp** format.

## Getting started

1. Add `sharp` to `resolutions` field in `package.json` to prevent versions mismatch\*:

```JSON
  "resolutions": {
    "sharp": "latest"
  }
```

\*_PayloadCMS' **sharp** dependency version is often behind. This is a problem since sharp does not work with multiple versions in a single project and old versions are also a security risk. Solution is setting the wanted sharp version in `resolutions` field._

2. Install the package with
   `npm i payload-webp` OR `yarn add payload-webp`

3. Import the plugin to your `payload.config.ts`:

```JS
import webp from "payload-webp";

// you may use this as fallback in your resizeOptsFactory
import { defaultResizeFactory } from "payload-webp";

export default buildConfig({
  ...
  plugins: [
      webp(webpPluginOptions)
  ]
)};
```

4. After uploading images to your upload-enabled collection new field called webp is added with converted image => webp file meteadata and its sizes.
   Access webp field with graphql like so:

```YAML
query {
  allMedia {
    docs {
      url               # url of original file [jpeg/png/webp]
      filesize          # filesize of original file
      webp {
        url             # url of webp processed file [webp]
        filesize        # filesize of webp processed file
        sizes {
          thumbnail {
            width
            height
            url
          }
        }
      }
    }
  }
}
```

By default webp images are being processed to reduce their filesize as well.

## Plugin options

Optionally you can pass JSON with following plugin options to tweak compression or limit conversion to particular mimeTypes or specific upload-enabled collections.

````JS
interface WebpPluginOptions {
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
```*/
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
 * _```orientation``` tag will be striped in either case as the image will be rotated based on its value during processing._
 */
  metadata?: boolean;
}
````

---

## Regenerate Webp images

You can regenerate existing images with following GraphQL mutation:

```JS
mutation {
  WebpRegenerate(slug: String!, sort: String) {
    currentFile
    current
    total
  }
}
```

### Arguments

| Argument | Description                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| slug     | Upload collection slug in camelCase                                                                            |
| sort     | You can pass the sort parameter to set the direction in which images will be regenerated. Default: `createdAt` |

### Fields and subsequent calls

You can use returned fields to show notify of current progress to user.
Any subsequent call while regeneration of particular collection is in the progress **will not** start new regeneration process, but will return current progress.

## Buffer objects

~~You can access buffer objects of processed image and all image sizes from Express request object `req.payloadWebp`. This way your adapter can store the files with external provider for an instance.
The maximum resolution webp buffer is at `req.payloadWebp.src`, other image sizes are at their respective name `req.payloadWebp[imageSizeName]`.~~
__currently unavailable due race conditions__
