"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const util = require("util");

const easyimage = require("easyimage");
const formidable = require("formidable");
const mime = require("mime");
const mkdirp = require("mkdirp");
const rimraf = require("rimraf");
const uuid = require("uuid");

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const lodash = Devebot.require("lodash");

const stringUtil = require("../supports/string-util");

function Service (params = {}) {
  const { filestoreHandler, errorBuilder, tracelogService, webweaverService } = params;
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();

  const pluginCfg = params.sandboxConfig || {};
  const contextPath = pluginCfg.contextPath || "/filestore";

  const tmpRootDir = os.tmpdir() + "/devebot/filestore";
  const uploadDir = pluginCfg.uploadDir;
  const thumbnailDir = pluginCfg.thumbnailDir || uploadDir;
  const thumbnailCfg = lodash.pick(pluginCfg, ["thumbnailMaxWidth", "thumbnailMaxHeight"]);
  const thumbnailFrameMatcher = ThumbnailFrameMatcher.newInstance(pluginCfg.thumbnailFrames);

  const express = webweaverService.express;

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
      name: "app-filestore-service",
      path: contextPath,
      middleware: filestoreRouter
    };
  };

  if (pluginCfg.autowired !== false) {
    tracelogService.push([
      this.getFilestoreLayer()
    ], pluginCfg.priority);
  }
};

function createUploadMiddleware (context) {
  context = context || {};
  const { L, T, errorBuilder, filestoreHandler, contextPath, tmpRootDir, verbose } = context;
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
      return parseUploadFormData.bind({ L, T })(ctx, req);
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
      res.status(404).json({ error: JSON.stringify(err) });
    })
    .finally(function() {
      if (ctx.tmpDir.match(tmpRootDir)) {
        removeDir.bind({L, T})(ctx.tmpDir);
      }
    });
    //
    return verbose ? promize : undefined;
  };
}

function createDownloadFileMiddleware (context) {
  context = context || {};
  const { L, T, errorBuilder, filestoreHandler, uploadDir, verbose } = context;
  //
  return function(req, res, next) {
    let promize = Promise.resolve()
    .then(function() {
      L && L.has("silly") && L.log("silly", T && T.add({
        fileId: req.params.fileId
      }).toMessage({
        text: " - /download/:fileId is request: ${fileId}"
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
      const mimetype = getMimeType(filepath);
      return transferFileToResponse.bind({L, T})(filename, filepath, mimetype, res);
    })
    .catch(function(err) {
      res.status(404).send("Error: " + JSON.stringify(err));
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
        return Promise.reject(errorBuilder.newError("WidthMustBeIntegerError"));
      }
      if (thumbnailMaxWidth && box.width > thumbnailMaxWidth) {
        return Promise.reject(errorBuilder.newError("WidthExceedsLimitError"));
      }
      //
      if (!lodash.isInteger(box.height)) {
        return Promise.reject(errorBuilder.newError("HeightMustBeIntegerError"));
      }
      if (thumbnailMaxHeight && box.height > thumbnailMaxHeight) {
        return Promise.reject(errorBuilder.newError("HeightExceedsLimitError"));
      }

      if (thumbnailFrameMatcher && !thumbnailFrameMatcher.isMatch(box.width, box.height)) {
        return Promise.reject(errorBuilder.newError("ThumbnailFrameIsMismatchedError"));
      }

      return filestoreHandler.getFileInfo(req.params.fileId);
    })
    .then(function(fileInfo) {
      if (lodash.isEmpty(fileInfo) || lodash.isEmpty(fileInfo.name)) {
        fileInfo = {
          name: "no-image.png",
          path: path.join(__dirname, "../../data/no-image.png")
        };
        box.originFile = path.join(__dirname, "../../data/no-image.png");
      } else {
        box.originFile = path.join(uploadDir, box.fileId, fileInfo.name);
      }

      box.fileInfo = fileInfo;
      box.thumbnailFile = path.join(thumbnailDir, box.fileId, util.format("thumbnail-%sx%s", box.width, box.height));

      L && L.has("silly") && L.log("silly", T && T.add(box).toMessage({
        text: " - thumbnailFile: ${thumbnailFile}"
      }));

      return resizeAndCropImage.bind({ L, T })(box);
    })
    .then(function(thumbnailFile) {
      const originalName = box.fileInfo.name;
      const filename = stringUtil.slugify(originalName);
      const mimetype = getMimeType(thumbnailFile);
      return transferFileToResponse.bind({ L, T })(filename, thumbnailFile, mimetype, res);
    })
    .catch(function(err) {
      res.status(404).send("Error: " + JSON.stringify(err));
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
    if (lodash.isArray(frames) && frames.lengh > 0) {
      this._frames = lodash.filter(frames, function(frame) {
        return lodash.isArray(frame) && frame.length == 2 &&
            lodash.isInteger(frame[0]) && frame[0] > 0 &&
            lodash.isInteger(frame[1]) && frame[1] > 0
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
  static newInstance(frames) {
    if (lodash.isArray(frames) && frames.lengh > 0) {
      return new ThumbnailFrameMatcher(frames);
    }
    return null;
  }
}

function getMimeType (fileNameOrPath) {
  return mime.lookup(fileNameOrPath);
}

function createDir (dirPath) {
  const { L, T } = this || {};
  return Promise.promisify(mkdirp)(dirPath);
}

function removeDir (dirPath) {
  const { L, T } = this || {};
  return new Promise(function(resolve, reject) {
    rimraf(dirPath, function(err) {
      if (err) {
        L && L.has("silly") && L.log("silly", T && T.add({
          name: err.name,
          message: err.message
        }).toMessage({
          text: " - the /upload cleanup has been error: ${name} - ${message}"
        }));
        reject(err);
      } else {
        L && L.has("silly") && L.log("silly", T && T.toMessage({
          text: " - the /upload cleanup has been successful"
        }));
        resolve();
      }
    });
  });
}

function resizeAndCropImage (box) {
  const { L, T } = this || {};
  return new Promise(function(resolve, reject) {
    fs.stat(box.thumbnailFile, function(err, stats) {
      if (!err) {
        return resolve(box.thumbnailFile);
      }
      // Note: ImageMagick may be not found
      easyimage.rescrop({
        src: box.originFile,
        dst: box.thumbnailFile,
        width: box.width,
        height: box.height,
        fill: true
      }).then(
        function(image) {
          L && L.has("silly") && L.log("silly", " - Converted: " + image.width + " x " + image.height);
          resolve(null, box.thumbnailFile);
        },
        function (err) {
          L && L.has("silly") && L.log("silly", " - Error on creating thumbnail: %s", err);
          reject(err);
        }
      );
    });
  });
}

function parseUploadFormData (ctx, req) {
  ctx = ctx || {};
  const { L, T } = this || ctx;
  return new Promise(function(resolve, reject) {
    let result = { fields: {}, files: {} };

    let form = new formidable.IncomingForm();
    form.uploadDir = ctx.tmpDir;
    form.keepExtensions = true;
    form
      .on("file", function(field, value) {
        L && L.has("silly") && L.log("silly", " - formidable trigger a file: %s", field);
        result.files[field] = value;
      })
      .on("field", function(field, value) {
        L && L.has("silly") && L.log("silly", " - formidable trigger a field: %s", field);
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

function transferFileToResponse (filename, fileLocationPath, mimetype, res) {
  const { L, T } = this || {};
  L && L.has("silly") && L.log("silly", T && T.add({ filename, mimetype }).toMessage({
    text: " - The file [${filename}] (${mimetype}) is downloading"
  }));
  return new Promise(function(resolve, reject) {
    res.setHeader("Content-disposition", "attachment; filename=" + filename);
    res.setHeader("Content-type", mimetype);
    const filestream = fs.createReadStream(fileLocationPath);
    filestream.on("error", function(err) {
      reject(err);
    });
    filestream.on("end", function() {
      L && L.has("silly") && L.log("silly", T && T.toMessage({
        text: " - the file has been full-loaded"
      }));
      resolve();
    });
    filestream.pipe(res);
  });
}

Service.referenceHash = {
  errorBuilder: "initializer",
  filestoreHandler: "handler",
  tracelogService: "app-tracelog/tracelogService",
  webweaverService: "app-webweaver/webweaverService"
};

module.exports = Service;
