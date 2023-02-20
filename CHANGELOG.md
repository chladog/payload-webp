# 1.1.0

- ### **BREAKING CHANGE**: `sharp` package dependency update.

As multiple `sharp` - the depdendency handling image processing - versions in single project is not supported, to be able to use the latest version of the `sharp` you need to set `resolutions` field in your `package.json` to a version you want to use.

For example:

```JSON
  // package.json
  "resolutions": {
    "sharp": "latest"
  }
```

Use of the latest sharp package version is recommended to mitigate security risks. However you are free to set any version your projects needs.

---

- ### **BREAKING CHANGE**: New config property `metadata`

Since this version EXIF metadata are being automatically stripped in the output image files to further reduce the size and better privacy (as EXIF data can contain information like name, address, GPS coordinates, hardware information etc.)
If you want to keep EXIF metadata in output images set the new config property `metadata` to `true`.

---

### Rotation of images

Images will be rotated automatically based on `orientation` EXIF tag, this implies removal of `orientation` tag afterwards (no matter what `metadata` option is set).

### New WebpRegenerateSingle mutation

That takes parameters `slug` (of file collection) and `id` (of upload document id).

For example:

```JS
WebpRegenerateSingle(slug: media, id:"63dec5264c9b6e7a068955ds")
```

# 1.0.19 (8.8.2022)

### Bugfixes

- added withMetadata() to sharp conversion to keep correct images orientation.

### Features

- original file is now being used to convert each webp size instead of resized onces to get better results
- new resizeOptsFactory config property
- new maxResize config property
- new WebpRegenerate GQL mutation for regenerating existing images
- new overwrite config property to configure duplicates handling
