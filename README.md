# payload-webp
**payloadcms/payload** plugin for automatic image conversion to **webp** format.


## Getting started

1. Install the package with
```npm i payload-webp``` OR ```yarn add payload-webp```
2. Import the plugin to your ```payload.config.ts```:

```JS
import webp from "payload-webp";

export default buildConfig({
  ...
  plugins: [
      webp(webpPluginOptions)
  ]
)};
```
3. After uploading images to your upload-enabled collection new field called webp is added with converted image => webp file meteadata and its sizes. 
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
```JS
interface WebpPluginOptions {
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
}
```
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
First Header  | Second Header
------------- | -------------
slug  | Upload collection slug in camelCase
sort  | You can pass the sort parameter to set the direction in which images will be regenerated. Default: ```createdAt```

### Fields and subsequent calls
You can use returned fields to show notify of current progress to user.
Any subsequent call while regeneration of particular collection is in the progress **will not** start new regeneration process, but will return current progress.