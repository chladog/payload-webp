import { ImageSize } from 'payload/dist/uploads/types';

export default (imageSize: ImageSize) => {
  return {
    width: imageSize.width,
    height: imageSize.height,
    options: {
      position: imageSize.crop || 'centre',
    },
  };
};
