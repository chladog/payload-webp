import { promisify } from 'util';
import sharp from 'sharp';
import fs from 'fs';
import { Access, AccessResult } from 'payload/config';
import { Forbidden } from 'payload/errors';
import { AfterReadHook } from 'payload/dist/collections/config/types';

export const getMetadata = (filenameWExt: string, info: sharp.OutputInfo) => {
  return {
    filesize: info.size,
    width: info.width,
    height: info.height,
    filename: filenameWExt,
    mimeType: 'image/webp',
  };
};

const stat = promisify(fs.stat);

export const fileExists = async (filename: string): Promise<boolean> => {
  try {
    await stat(filename);
    return true;
  } catch (err) {
    return false;
  }
};

export const executeAccess = async (operation, access: Access): Promise<AccessResult> => {
  if (access) {
    const result = await access(operation);

    if (!result) {
      if (!operation.disableErrors) throw new Forbidden();
    }

    return result;
  }

  if (operation.req.user) {
    return true;
  }

  if (!operation.disableErrors) throw new Forbidden();
  return false;
};


export const afterReadUrlHook: (filename: string | undefined, staticURL: string, serverURL?: string) => AfterReadHook = (filename, staticURL, serverURL) => (args) => {
  if (filename) {
    if (staticURL.startsWith('/')) {
      return `${serverURL || '/'}${staticURL}/${filename}`;
    }
    return `${staticURL}/${filename}`;
  }
  return undefined;
}