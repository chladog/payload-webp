import { promisify } from "util";
import sharp from "sharp";
import fs from "fs";

export const getMetadata = (filenameWExt: string, info: sharp.OutputInfo) => {
    return {
      filesize: info.size,
      width: info.width,
      height: info.height,
      filename: filenameWExt,
      mimeType: "image/webp",
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
  