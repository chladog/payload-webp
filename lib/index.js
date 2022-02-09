"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var deepmerge_1 = __importDefault(require("deepmerge"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var sharp_1 = __importDefault(require("sharp"));
var errors_1 = require("payload/errors");
var utils_1 = require("./utils");
var getFileMetadataFields_1 = __importDefault(require("./getFileMetadataFields"));
var webp = function (pluginOptions) {
    return function (config) {
        var sharpWebpOpts = (pluginOptions === null || pluginOptions === void 0 ? void 0 : pluginOptions.sharpWebpOptions)
            ? __assign({ force: true }, pluginOptions.sharpWebpOptions) : {
            nearLossless: true,
            quality: 50,
            force: true,
        };
        // mock plugin to avoid webpack errors in frontend
        config.admin.webpack = function (webpackConfig) {
            webpackConfig.resolve.alias[path_1.default.resolve(__dirname, "./webp")] = path_1.default.resolve(__dirname, "./mock-plugin");
            return webpackConfig;
        };
        var uploadCollections = (pluginOptions === null || pluginOptions === void 0 ? void 0 : pluginOptions.collections)
            ? config.collections.filter(function (collection) {
                return pluginOptions.collections.includes(collection.slug) &&
                    !!collection.upload;
            })
            : config.collections.filter(function (collection) { return !!collection.upload; });
        uploadCollections.forEach(function (uploadCollection) {
            var uploadOptions = typeof uploadCollection.upload === "object"
                ? uploadCollection.upload
                : {};
            var webpFields = {
                name: "webp",
                type: "group",
                admin: {
                    readOnly: true,
                    disabled: true,
                },
                fields: __spreadArray(__spreadArray([], (0, getFileMetadataFields_1.default)(function (_a) {
                    var _b;
                    var data = _a.data;
                    if ((_b = data === null || data === void 0 ? void 0 : data.webp) === null || _b === void 0 ? void 0 : _b.filename) {
                        return "".concat(config.serverURL).concat(uploadOptions.staticURL, "/").concat(data.webp.filename);
                    }
                    return undefined;
                }), true), [
                    {
                        name: "sizes",
                        type: "group",
                        fields: uploadOptions.imageSizes.map(function (size) { return ({
                            label: size.name,
                            name: size.name,
                            type: "group",
                            admin: {
                                disabled: true,
                            },
                            fields: __spreadArray([], (0, getFileMetadataFields_1.default)(function (_a) {
                                var _b, _c;
                                var data = _a.data;
                                var sizeFilename = (_c = (_b = data === null || data === void 0 ? void 0 : data.sizes) === null || _b === void 0 ? void 0 : _b[size.name]) === null || _c === void 0 ? void 0 : _c.filename;
                                if (sizeFilename) {
                                    return "".concat(config.serverURL).concat(uploadOptions.staticURL, "/").concat(sizeFilename);
                                }
                                return undefined;
                            }), true),
                        }); }),
                        admin: {
                            disabled: true,
                        },
                    },
                ], false),
            };
            uploadCollection.fields.push(webpFields);
            var afterChangeHook = function (args) { return __awaiter(void 0, void 0, void 0, function () {
                var payload, staticPath, file, filename, converted, bufferObject, filenameExt, imagePath, fileAlreadyExists, _i, _a, _b, key, value, converted, bufferObject, imageNameWithDimensions, imagePath, fileAlreadyExists;
                var _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            payload = args.req.payload;
                            staticPath = uploadOptions.staticDir;
                            if (uploadOptions.staticDir.indexOf("/") !== 0) {
                                staticPath = path_1.default.resolve(payload.config.paths.configDir, uploadOptions.staticDir);
                            }
                            if (!((pluginOptions === null || pluginOptions === void 0 ? void 0 : pluginOptions.mimeTypes) || [
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                            ]).includes(args.doc.mimeType)) {
                                return [2 /*return*/];
                            }
                            file = (args.req.files || {}).file;
                            filename = args.doc.filename.substring(0, args.doc.filename.lastIndexOf(".")) ||
                                args.doc.filename;
                            if (((_c = args.doc.webp) === null || _c === void 0 ? void 0 : _c.filename) &&
                                filename ===
                                    args.doc.webp.filename.substring(0, args.doc.filename.lastIndexOf("."))) {
                                return [2 /*return*/];
                            }
                            if (!file) return [3 /*break*/, 5];
                            converted = (0, sharp_1.default)(file.data).webp(sharpWebpOpts);
                            return [4 /*yield*/, converted.toBuffer({
                                    resolveWithObject: true,
                                })];
                        case 1:
                            bufferObject = _e.sent();
                            filenameExt = "".concat(filename, ".webp");
                            imagePath = "".concat(staticPath, "/").concat(filenameExt);
                            return [4 /*yield*/, (0, utils_1.fileExists)(imagePath)];
                        case 2:
                            fileAlreadyExists = _e.sent();
                            if (fileAlreadyExists) {
                                fs_1.default.unlinkSync(imagePath);
                            }
                            if (!!uploadOptions.disableLocalStorage) return [3 /*break*/, 4];
                            return [4 /*yield*/, converted.toFile(imagePath)];
                        case 3:
                            _e.sent();
                            _e.label = 4;
                        case 4:
                            Object.assign(args.doc.webp, (0, utils_1.getMetadata)(filenameExt, bufferObject.info));
                            _e.label = 5;
                        case 5:
                            if (!((_d = args === null || args === void 0 ? void 0 : args.req) === null || _d === void 0 ? void 0 : _d.payloadUploadSizes)) return [3 /*break*/, 12];
                            _i = 0, _a = Object.entries(args.req.payloadUploadSizes);
                            _e.label = 6;
                        case 6:
                            if (!(_i < _a.length)) return [3 /*break*/, 12];
                            _b = _a[_i], key = _b[0], value = _b[1];
                            converted = (0, sharp_1.default)(value).webp(sharpWebpOpts);
                            return [4 /*yield*/, converted.toBuffer({
                                    resolveWithObject: true,
                                })];
                        case 7:
                            bufferObject = _e.sent();
                            imageNameWithDimensions = "".concat(filename, "-").concat(bufferObject.info.width, "x").concat(bufferObject.info.height, ".webp");
                            imagePath = "".concat(staticPath, "/").concat(imageNameWithDimensions);
                            return [4 /*yield*/, (0, utils_1.fileExists)(imagePath)];
                        case 8:
                            fileAlreadyExists = _e.sent();
                            if (fileAlreadyExists) {
                                fs_1.default.unlinkSync(imagePath);
                            }
                            if (!!uploadOptions.disableLocalStorage) return [3 /*break*/, 10];
                            return [4 /*yield*/, converted.toFile(imagePath)];
                        case 9:
                            _e.sent();
                            _e.label = 10;
                        case 10:
                            args.doc.webp.sizes[key] = (0, utils_1.getMetadata)(imageNameWithDimensions, bufferObject.info);
                            _e.label = 11;
                        case 11:
                            _i++;
                            return [3 /*break*/, 6];
                        case 12:
                            payload
                                .update({
                                collection: uploadCollection.slug,
                                data: args.doc,
                                id: args.doc.id,
                            })
                                .then();
                            return [2 /*return*/, args.doc];
                    }
                });
            }); };
            var afterDeleteHook = function (_a) {
                var req = _a.req, id = _a.id, doc = _a.doc;
                return __awaiter(void 0, void 0, void 0, function () {
                    var staticPath_1, fileToDelete;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (!(uploadCollection.upload && ((_b = doc.webp) === null || _b === void 0 ? void 0 : _b.filename))) return [3 /*break*/, 2];
                                staticPath_1 = path_1.default.resolve(req.payload.config.paths.configDir, uploadOptions.staticDir);
                                fileToDelete = "".concat(staticPath_1, "/").concat(doc.webp.filename);
                                return [4 /*yield*/, (0, utils_1.fileExists)(fileToDelete)];
                            case 1:
                                if (_c.sent()) {
                                    fs_1.default.unlink(fileToDelete, function (err) {
                                        if (err) {
                                            throw new errors_1.ErrorDeletingFile();
                                        }
                                    });
                                }
                                if (doc.webp.sizes) {
                                    Object.values(doc.webp.sizes).forEach(function (size) { return __awaiter(void 0, void 0, void 0, function () {
                                        var sizeToDelete;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    sizeToDelete = "".concat(staticPath_1, "/").concat(size.filename);
                                                    return [4 /*yield*/, (0, utils_1.fileExists)(sizeToDelete)];
                                                case 1:
                                                    if (_a.sent()) {
                                                        fs_1.default.unlink(sizeToDelete, function (err) {
                                                            if (err) {
                                                                throw new errors_1.ErrorDeletingFile();
                                                            }
                                                        });
                                                    }
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                }
                                _c.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                });
            };
            if (!uploadCollection.hooks) {
                uploadCollection.hooks = {};
            }
            uploadCollection.hooks = (0, deepmerge_1.default)(uploadCollection.hooks, {
                afterChange: [afterChangeHook],
                afterDelete: [afterDeleteHook],
            });
        });
        return config;
    };
};
exports.default = webp;
