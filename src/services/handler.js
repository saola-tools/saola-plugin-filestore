"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const easyimage = require("easyimage");
const mime = require("mime");
const mv = require("mv");
const uuid = require("uuid");

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const chores = FRWK.require("chores");
const lodash = FRWK.require("lodash");

const { PortletMixiner } = FRWK.require("portlet");

const { createDir } = require("../supports/system-util");
const stringUtil = require("../supports/string-util");

function Handler (params = {}) {
  const { packageName, loggingFactory, configPortletifier, tracelogService, mongoManipulator } = params;

  PortletMixiner.call(this, {
    portletDescriptors: configPortletifier.getPortletDescriptors(["default"]),
    portletReferenceHolders: { tracelogService },
    portletArguments: { packageName, loggingFactory, mongoManipulator },
    PortletConstructor: Portlet,
  });

  // @deprecated
  this.getFileInfo = function (fileId) {
    return this.hasPortlet() && this.getPortlet().getFileInfo(fileId) || undefined;
  };

  // @deprecated
  this.getFileUrls = function (fileIds = []) {
    return this.hasPortlet() && this.getPortlet().getFileUrls(fileIds) || undefined;
  };

  // @deprecated
  this.saveFile = function (args = {}) {
    return this.hasPortlet() && this.getPortlet().saveFile(args) || undefined;
  };
}

Object.assign(Handler.prototype, PortletMixiner.prototype);

function Portlet (params = {}) {
  const { packageName, loggingFactory, portletConfig, portletName, mongoManipulator } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  L && L.has("silly") && L.log("silly", T && T.add({ blockRef, portletName }).toMessage({
    tags: [ blockRef ],
    text: "The Portlet[${blockRef}][${portletName}] is loading"
  }));

  // const portletConfig = params.sandboxConfig || {};
  const contextPath = portletConfig.contextPath || "/filestore";
  const uploadDir = portletConfig.uploadDir;
  const collectionName = portletConfig.collections.FILE;
  const tmpRootDir = _osTmpDir() + portletConfig.tmpBasePath || "/saola-plugin-filestore";

  this.getFileInfo = function (fileId) {
    return mongoManipulator.findOneDocument(collectionName, {
      fileId: fileId,
      status: "ok"
    });
  };

  this.getFileUrls = function(fileIds = []) {
    return Promise.map(fileIds, function(fileId) {
      const r = mongoManipulator.findOneDocument(collectionName, {fileId});
      return r.then(function(fileData) {
        if (lodash.isEmpty(fileData)) {
          return { fileId };
        } else {
          return lodash.pick(fileData, ["_id", "fileId", "fileUrl"]);
        }
      });
    }, {concurrency: 4});
  };

  /**
   * @param {*} args
   *   fileId: UUID
   *   fileType: 'path', 'stream' or 'base64'
   *   fileSource: url, stream, or base64 String
   *   fileInfo: (size, name, path. ...)
   */
  this.saveFile = function(args = {}) {
    let {fileId, fileType, fileSource, fileInfo} = args;

    L.has("debug") && L.log("debug", " - saveFile: %s", JSON.stringify(args, null, 2));

    fileId = fileId || uuid.v4();
    fileInfo = fileInfo || {};
    fileInfo.name = fileInfo.name || fileId;

    fileInfo.originalName = fileInfo.name;
    fileInfo.name = stringUtil.slugify(fileInfo.name);

    let fileName = fileInfo.name;
    let ctx = {};

    return Promise.resolve()
    .then(function(result) {
      fileInfo.fileId = fileId;
      fileInfo.status = "intermediate";

      return mongoManipulator.updateDocument(
        collectionName,
        { fileId: fileId }, fileInfo, { multi: true, upsert: true });
    })
    .then(function() {
      ctx.uploadDirPath = path.join(uploadDir, fileId);
      return createDir(ctx.uploadDirPath);
    })
    .then(function() {
      switch (fileType) {
        case "path":
        return Promise.promisify(function(done) {
          // fileSource is the path of temporary file in this scenario
          mv(fileSource, path.join(ctx.uploadDirPath, fileName), function(err) {
            done(err);
          });
        })();
        case "base64":
        // fileSource is the file content in base64 format
        const fsWriteFile = Promise.promisify(fs.writeFile, {context: fs});
        fileSource = fileSource.replace(/^data:image\/[a-zA-Z0-9]*;base64,/, "");
        return fsWriteFile(path.join(ctx.uploadDirPath, fileName), fileSource, {
          encoding: "base64"
        });
      }
    })
    .then(function() {
      fileInfo.path = path.join(ctx.uploadDirPath, fileName);
      fileInfo.fileUrl = path.join(contextPath, "/download/" + fileId);
      fileInfo.status = "ok";
      return mongoManipulator.updateDocument(
        collectionName,
        { fileId: fileId }, fileInfo, { multi: true, upsert: false });
    })
    .then(function() {
      const fileCollection = mongoManipulator.mongojs.collection(collectionName);
      const findOne = Promise.promisify(fileCollection.findOne, { context: fileCollection });
      return findOne({ fileId: fileId });
    })
    .then(function(doc) {
      L.has("debug") && L.log("debug", T.toMessage({
        text: "The /upload has been done successfully"
      }));
      let returnInfo = {};
      returnInfo["_id"] = doc._id;
      returnInfo["fileId"] = doc.fileId;
      returnInfo["fileUrl"] = doc.fileUrl;
      return returnInfo;
    });
  };

  this.transferFileToOutputStream = function(fileLocationPath, outputStream) {
    return transferFileToOutputStream.call(this, fileLocationPath, outputStream);
  };

  this.createImageThumbnail = function(fileContext, {thumbnailDir, uploadDir} = {}) {
    const { fileInfo } = fileContext;
    if (lodash.isEmpty(fileInfo) || lodash.isEmpty(fileInfo.name)) {
      return getImageNotFoundThumbnail.call(this, {
        thumbnailDir,
        width: fileContext.width,
        height: fileContext.height
      });
    } else {
      return createImageThumbnail.call(this, {
        uploadDir,
        thumbnailDir,
        fileId: fileContext.fileId,
        fileName: fileInfo.name,
        width: fileContext.width,
        height: fileContext.height
      });
    }
  };

  this.getTmpRootDir = function () {
    return tmpRootDir;
  };

  this.getMimeType = function (fileLocationPath, { basePath } = {}) {
    return getMimeType(fileLocationPath);
  };
};

Handler.referenceHash = {
  configPortletifier: "portletifier",
  tracelogService: "@saola/plugin-logtracer/tracelogService",
  mongoManipulator: "mongojs#manipulator"
};

module.exports = Handler;

function transferFileToOutputStream (fileLocationPath, outputStream) {
  const { L, T } = this || {};
  return new Promise(function(resolve, reject) {
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
    filestream.pipe(outputStream);
  });
}

function getImageNotFoundThumbnail ({ staticDir, thumbnailDir, width, height } = {}) {
  staticDir = staticDir || path.join(__dirname, "../../data/");
  thumbnailDir = thumbnailDir || staticDir;
  //
  const originFile = path.join(staticDir, "no-image.png");
  const thumbnailFile = path.join(thumbnailDir, util.format("no-image-thumbnail-%sx%s", width, height));
  //
  return resizeAndCropImage.call(this, { originFile, thumbnailFile, width, height });
}

function createImageThumbnail ({ uploadDir, thumbnailDir, fileId, fileName, width, height } = {}) {
  const originFile = path.join(uploadDir, fileId, fileName);
  const thumbnailFile = path.join(thumbnailDir, fileId, util.format("thumbnail-%sx%s", width, height));
  //
  return resizeAndCropImage.call(this, { originFile, thumbnailFile, width, height });
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
          L && L.has("silly") && L.log("silly", T && T.toMessage({
            text: " - Converted: " + image.width + " x " + image.height
          }));
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

function _osTmpDir () {
  return os.tmpdir();
}

function getMimeType (fileNameOrPath) {
  const mimeType = mime.getType(fileNameOrPath);
  if (mimeType == null) {
    return "application/octet-stream";
  }
  return mimeType;
};
