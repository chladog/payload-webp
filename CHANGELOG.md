## 1.0.19 (8.8.2022)

### Bugfixes

* added withMetadata() to sharp conversion to keep correct images orientation.

### Features

* original file is now being used to convert each webp size instead of resized onces to get better results
* new resizeFactoryOpts config property 
* new maxResize config property
* new WebpRegenerate GQL mutation for regenerating existing images
* new overwrite config property to configure duplicates handling
