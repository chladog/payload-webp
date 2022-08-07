import { Field, FieldHook } from 'payload/types';

export interface ImageFields {
  filename: string;
  filesize: number;
  width: number;
  height: number;
  mimeType: string;
  url: string;
}

const getFileMetadataFields: (afterReadHook: FieldHook) => Field[] = (afterReadHook) => [
  { name: 'filename', type: 'text', unique: true },
  {
    name: 'filesize',
    label: 'File Size',
    type: 'number',
    admin: {
      readOnly: true,
      disabled: true,
    },
  },
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    admin: {
      readOnly: true,
      disabled: true,
    },
  },
  {
    name: 'mimeType',
    label: 'MIME Type',
    type: 'text',
    admin: {
      readOnly: true,
      disabled: true,
    },
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    admin: {
      readOnly: true,
      disabled: true,
    },
  },
  {
    name: 'url',
    label: 'URL',
    type: 'text',
    admin: {
      readOnly: true,
      disabled: true,
    },
    hooks: {
      afterRead: [afterReadHook],
    },
  },
];

export default getFileMetadataFields;
