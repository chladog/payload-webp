import { Config, Plugin } from 'payload/config';

import { WebpPluginOptions } from './config.interface';
import { WebpPlugin } from './Plugin';
import defaultResizeFactory from './utils/defaultResizeFactory';

/**
```JS 
 import webp from "payload-webp"; // webp plugin
```

```JS 
 import { defaultResizeFactory } from "payload-webp";// you may use this as fallback in your resizeOptsFactory
```
 */
const webp: (pluginOptions?: WebpPluginOptions) => Plugin = (pluginOptions) => (incomingConfig: Config) => {
  const convertor = new WebpPlugin(incomingConfig, pluginOptions);
  return convertor.config;
};

export default webp;
export { defaultResizeFactory };
