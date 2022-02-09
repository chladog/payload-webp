# payload-webp
**payloadcms/payload** plugin for automatic image conversion to **webp** format.


## Getting started

1. Install the package with
```npm i payload-webp``` OR ```yarn add payload-webp```
2. Import the plugin to your ```payload.config.ts```:

```JS
import webp from "payload-webp";

export default buildConfig({
  serverURL: "http://localhost:3000",
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
```