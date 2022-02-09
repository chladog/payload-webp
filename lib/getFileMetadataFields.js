"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var getFileMetadataFields = function (afterReadHook) { return [
    { name: "filename", type: "text", unique: true },
    {
        name: "filesize",
        label: "File Size",
        type: "number",
        admin: {
            readOnly: true,
            disabled: true,
        },
    },
    {
        name: "width",
        label: "Width",
        type: "number",
        admin: {
            readOnly: true,
            disabled: true,
        },
    },
    {
        name: "mimeType",
        label: "MIME Type",
        type: "text",
        admin: {
            readOnly: true,
            disabled: true,
        },
    },
    {
        name: "height",
        label: "Height",
        type: "number",
        admin: {
            readOnly: true,
            disabled: true,
        },
    },
    {
        name: "url",
        label: "URL",
        type: "text",
        admin: {
            readOnly: true,
            disabled: true,
        },
        hooks: {
            afterRead: [afterReadHook],
        },
    },
]; };
exports.default = getFileMetadataFields;
