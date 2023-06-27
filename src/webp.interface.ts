import sharp from "sharp";
import { File } from 'payload/dist/uploads/types';

export interface ResultObject {
    originalFile: File;
    name: string;
    bufferObject: BufferObject;
    filename: any;
    filenameExt: any;
}

export interface BufferObject {
    data: Buffer;
    info: sharp.OutputInfo;
}