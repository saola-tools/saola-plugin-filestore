"use strict";

const path = require("path");

const formidable = require("formidable");
const uuid = require("uuid");

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const lodash = FRWK.require("lodash");
const chores = FRWK.require("chores");

const { PortletMixiner } = FRWK.require("portlet");

const { createDir, removeDir } = require("../supports/system-util");
const stringUtil = require("../supports/string-util");

function Service (params = {}) {
  const { packageName, loggingFactory, configPortletifier } = params;
  const { errorBuilder, filestoreHandler, tracelogService, webweaverService } = params;

  const express = webweaverService.express;

  PortletMixiner.call(this, {
    portletDescriptors: configPortletifier.getPortletDescriptors(["default"]),
    portletReferenceHolders: { filestoreHandler, tracelogService },
    portletArguments: { packageName, loggingFactory, express, errorBuilder },
    PortletConstructor: Portlet,
  });

  // @deprecated
  this.getFilestoreLayer = function() {
    return this.hasPortlet() && this.getPortlet().getFilestoreLayer() || undefined;
  };
}

Object.assign(Service.prototype, PortletMixiner.prototype);

function Portlet (params = {}) {
  const { packageName, loggingFactory, express, portletName, portletConfig } = params;
  const { errorBuilder, filestoreHandler, tracelogService } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is loading"
  }));

  const contextPath = portletConfig.contextPath || "/filestore";

  const tmpRootDir = filestoreHandler.getTmpDirHome();
  const uploadDir = portletConfig.uploadDir;
  const thumbnailDir = portletConfig.thumbnailDir || uploadDir;
  const thumbnailCfg = lodash.pick(portletConfig, ["thumbnailMaxWidth", "thumbnailMaxHeight"]);
  const thumbnailFrameMatcher = ThumbnailFrameMatcher.newInstance(portletConfig.thumbnailFrames);

  const filestoreRouter = express();

  filestoreRouter.route([
    "/upload"
  ]).post(createUploadMiddleware({
    L, T, errorBuilder, filestoreHandler, contextPath, tmpRootDir
  }));

  filestoreRouter.route([
    "/download/:fileId",
    "/download/:fileId/:filename"
  ]).get(createDownloadFileMiddleware({
    L, T, errorBuilder, filestoreHandler, uploadDir
  }));

  filestoreRouter.route([
    "/picture/:fileId/:width/:height",
    "/picture/:fileId/:width/:height/:filename"
  ]).get(createShowPictureMiddleware({
    L, T, errorBuilder, filestoreHandler, uploadDir, thumbnailDir, ...thumbnailCfg, thumbnailFrameMatcher
  }));

  this.getFilestoreLayer = function() {
    return {
      name: "saola-plugin-filestore-service",
      path: contextPath,
      middleware: filestoreRouter
    };
  };

  if (portletConfig.autowired !== false) {
    tracelogService.push([
      this.getFilestoreLayer()
    ], portletConfig.priority);
  }
};

function createUploadMiddleware (context) {
  context = context || {};
  const { L, T, errorBuilder, filestoreHandler, contextPath, tmpRootDir, verbose } = context;
  const that = { L, T };
  //
  return function(req, res, next) {
    L && L.has("silly") && L.log("silly", " - the /upload is requested ...");

    let tmpId = uuid.v4();
    let ctx = {
      tmpDir: path.join(tmpRootDir, tmpId)
    };

    let promize = Promise.resolve()
    .then(function() {
      L && L.has("silly") && L.log("silly", T && T.add({ tmpDir: ctx.tmpDir }).toMessage({
        text: " - the tmpDir: ${tmpDir}"
      }));
      return createDir(ctx.tmpDir);
    })
    .then(function() {
      return parseUploadFormData.bind(that)(req, ctx);
    })
    .then(function(result) {
      L && L.has("silly") && L.log("silly", " - the /upload result: %s", JSON.stringify(result, null, 2));
      ctx.fileId = result.fields.fileId || uuid.v4();
      ctx.fileInfo = lodash.pick(result.files.data || {}, ["size", "path", "name", "type", "mtime"]);
      ctx.fileType = "path";
      ctx.fileSource = ctx.fileInfo.path;
      if (lodash.isEmpty(ctx.fileId)) {
        return Promise.reject(errorBuilder.newError("FileIdMustNotBeEmptyError"));
      }
      if (lodash.isEmpty(ctx.fileInfo)) {
        return Promise.reject(errorBuilder.newError("FileDataMustNotBeEmptyError"));
      }
      return filestoreHandler.saveFile(ctx);
    })
    .then(function(returnInfo) {
      L && L.has("silly") && L.log("silly", " - the file has been saved successfully: %s", JSON.stringify(returnInfo, null, 2));
      returnInfo["fileUrl"] = path.join(contextPath, "/download/" + ctx.fileId);
      res.json(returnInfo);
      return returnInfo;
    })
    .catch(function(err) {
      L && L.has("silly") && L.log("silly", " - error: %s; context: %s", JSON.stringify(err), JSON.stringify(ctx, null, 2));
      renderErrorToResponse({ action: "upload" }, err, res);
    })
    .finally(function() {
      if (ctx.tmpDir.match(tmpRootDir)) {
        removeDir.bind(that)(ctx.tmpDir);
      }
    });
    //
    return verbose ? promize : undefined;
  };
}

function createDownloadFileMiddleware (context) {
  context = context || {};
  const { L, T, errorBuilder, filestoreHandler, uploadDir, verbose } = context;
  const that = { L, T };
  //
  return function(req, res, next) {
    let promize = Promise.resolve()
    .then(function() {
      L && L.has("silly") && L.log("silly", T && T.add({
        fileId: req.params.fileId
      }).toMessage({
        text: " - /download/:fileId is requested: ${fileId}"
      }));
      if (lodash.isEmpty(req.params.fileId)) {
        return Promise.reject(errorBuilder.newError("FileIdMustNotBeEmptyError"));
      }
      return filestoreHandler.getFileInfo(req.params.fileId);
    })
    .then(function(fileInfo) {
      if (lodash.isEmpty(fileInfo)) {
        return Promise.reject(errorBuilder.newError("FileIdNotFoundError"));
      }
      const originalName = fileInfo.name || path.basename(fileInfo.path);
      const filename = stringUtil.slugify(originalName);
      const filepath = path.join(uploadDir, fileInfo.fileId, fileInfo.name);
      const mimetype = filestoreHandler.getMimeType(filepath);
      return transferFileToResponse.call(that, filestoreHandler, filename, filepath, mimetype, res);
    })
    .catch(function(err) {
      renderErrorToResponse({ action: "download" }, err, res);
    });
    //
    return verbose ? promize : undefined;
  };
}

function createShowPictureMiddleware (context) {
  context = context || {};
  const { L, T, errorBuilder, filestoreHandler, uploadDir, thumbnailDir, verbose } = context;
  const { thumbnailMaxWidth, thumbnailMaxHeight, thumbnailFrameMatcher } = context;
  //
  const that = { L, T };
  //
  return function(req, res, next) {
    let box = {};
    let promize = Promise.resolve()
    .then(function() {
      L && L.has("silly") && L.log("silly", T && T.add({
        fileId: req.params.fileId,
        width: req.params.width,
        height: req.params.height,
      }).toMessage({
        text: " - /picture/${fileId}/${width}/${height} is requested"
      }));

      if (lodash.isEmpty(req.params.fileId)) {
        return Promise.reject(errorBuilder.newError("FileIdMustNotBeEmptyError"));
      }
      //
      if (lodash.isEmpty(req.params.width)) {
        return Promise.reject(errorBuilder.newError("WidthMustNotBeEmptyError"));
      }
      //
      if (lodash.isEmpty(req.params.height)) {
        return Promise.reject(errorBuilder.newError("HeightMustNotBeEmptyError"));
      }

      box.fileId = req.params.fileId;
      box.width = parseInt(req.params.width);
      box.height = parseInt(req.params.height);

      if (!lodash.isInteger(box.width)) {
        return Promise.reject(errorBuilder.newError("WidthMustBeIntegerError", {
          payload: {
            width: box.width,
            typeOfWidth: (typeof box.width),
          }
        }));
      }
      if (thumbnailMaxWidth && box.width > thumbnailMaxWidth) {
        return Promise.reject(errorBuilder.newError("WidthExceedsLimitError", {
          payload: {
            width: box.width,
            maxWidth: thumbnailMaxWidth,
          }
        }));
      }
      //
      if (!lodash.isInteger(box.height)) {
        return Promise.reject(errorBuilder.newError("HeightMustBeIntegerError", {
          payload: {
            height: box.height,
            typeOfHeight: (typeof box.height),
          }
        }));
      }
      if (thumbnailMaxHeight && box.height > thumbnailMaxHeight) {
        return Promise.reject(errorBuilder.newError("HeightExceedsLimitError", {
          payload: {
            height: box.height,
            maxHeight: thumbnailMaxHeight,
          }
        }));
      }

      if (thumbnailFrameMatcher && !thumbnailFrameMatcher.isMatch(box.width, box.height)) {
        return Promise.reject(errorBuilder.newError("ThumbnailFrameIsMismatchedError"));
      }

      return filestoreHandler.getFileInfo(req.params.fileId);
    })
    .then(function(fileInfo) {
      box.fileInfo = fileInfo;
      return filestoreHandler.createImageThumbnail(box, {thumbnailDir, uploadDir});
    })
    .then(function(thumbnailFile) {
      box.thumbnailFile = thumbnailFile;
      //
      L && L.has("silly") && L.log("silly", T && T.add(box).toMessage({
        text: " - thumbnailFile: ${thumbnailFile}"
      }));
      //
      const originalName = box.fileInfo.name;
      const filename = stringUtil.slugify(originalName);
      const mimetype = filestoreHandler.getMimeType(thumbnailFile);
      return transferFileToResponse.call(that, filestoreHandler, filename, thumbnailFile, mimetype, res);
    })
    .catch(function(err) {
      renderErrorToResponse({ action: "thumbnail" }, err, res);
    });
    //
    return verbose ? promize : undefined;
  };
}

class ThumbnailFrameMatcher {
  constructor (frames) {
    this._frames = [];
    this._skipped = false;
    //
    if (lodash.isArray(frames) && lodash.size(frames) > 0) {
      this._frames = lodash.filter(frames, function(frame) {
        return lodash.isArray(frame) && frame.length == 2 &&
            lodash.isInteger(frame[0]) && frame[0] > 0 &&
            lodash.isInteger(frame[1]) && frame[1] > 0;
      });
    } else {
      this._skipped = true;
    }
  }
  //
  isMatch (width, height) {
    if (this._skipped) {
      return true;
    }
    //
    for (const frame of this._frames) {
      if (frame[0] == width && frame[1] == height) {
        return true;
      }
    }
    //
    return false;
  }
  //
  static newInstance (frames) {
    if (lodash.isArray(frames) && lodash.size(frames) > 0) {
      return new ThumbnailFrameMatcher(frames);
    }
    return null;
  }
}

function parseUploadFormData (req, ctx) {
  ctx = ctx || {};
  const { L, T } = this || {};
  return new Promise(function(resolve, reject) {
    let result = { fields: {}, files: {} };

    let form = new formidable.IncomingForm();
    form.uploadDir = ctx.tmpDir;
    form.keepExtensions = true;
    form
      .on("file", function(field, value) {
        L && L.has("silly") && L.log("silly", T && T.add({ field }).toMessage({
          text: " - formidable trigger a file: ${field}"
        }));
        result.files[field] = value;
      })
      .on("field", function(field, value) {
        L && L.has("silly") && L.log("silly", T && T.add({ field }).toMessage({
          text: " - formidable trigger a field: ${field}"
        }));
        result.fields[field] = value;
      })
      .on("error", function(err) {
        L && L.has("silly") && L.log("silly", " -> upload has error: %s", JSON.stringify(err));
        reject(err);
      })
      .on("end", function() {
        L && L.has("silly") && L.log("silly", " -> upload has done");
        resolve(result);
      });

    form.parse(req);
  });
}

function transferFileToResponse (filestoreHandler, filename, fileLocationPath, mimetype, res) {
  const { L, T } = this || {};
  L && L.has("silly") && L.log("silly", T && T.add({ filename, mimetype }).toMessage({
    text: " - The file [${filename}] (${mimetype}) is downloading"
  }));
  res.setHeader("Content-disposition", "attachment; filename=" + filename);
  res.setHeader("Content-type", mimetype);
  return filestoreHandler.transferFileToOutputStream(fileLocationPath, res);
}

function renderErrorToResponse (context, error, res) {
  context = context || {};
  if (context.prettyError) {
    renderPacketToResponse(transformErrorToPacket(error), res);
  } else {
    if (context.action == "upload") {
      res.status(404).json({ error: JSON.stringify(error) });
    } else {
      res.status(404).send("Error: " + JSON.stringify(error));
    }
  }
}

function transformErrorToPacket (error) {
  // statusCode, headers, body
  let packet = {
    statusCode: error.statusCode || 500,
    headers: {},
    body: {
      name: error.name,
      message: error.message
    }
  };
  // payload
  if (lodash.isObject(error.payload)) {
    packet.body.payload = error.payload;
  }
  // Error.stack
  if (chores.isDevelopmentMode()) {
    packet.body.stack = lodash.split(error.stack, "\n");
  }
  //
  return packet;
}

function renderPacketToResponse (packet = {}, res) {
  if (lodash.isObject(packet.headers)) {
    lodash.forOwn(packet.headers, function (value, key) {
      res.set(key, value);
    });
  }
  res.status(packet.statusCode || 200);
  if (lodash.isNil(packet.body)) {
    res.end();
  } else {
    if (lodash.isString(packet.body)) {
      res.send(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

Service.referenceHash = {
  configPortletifier: "portletifier",
  errorBuilder: "initializer",
  filestoreHandler: "handler",
  tracelogService: "@saola/plugin-logtracer/tracelogService",
  webweaverService: "@saola/plugin-webweaver/webweaverService"
};

module.exports = Service;
