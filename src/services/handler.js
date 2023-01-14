"use strict";

const fs = require("fs");
const path = require("path");

const mv = require("mv");
const uuid = require("uuid");

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");

const portlet = require("app-webserver").require("portlet");
const { PORTLETS_COLLECTION_NAME, PortletMixiner } = portlet;

const { createDir } = require("../supports/system-util");
const stringUtil = require("../supports/string-util");

function Handler (params = {}) {
  const { packageName, loggingFactory, configPortletifier, tracelogService, mongoManipulator } = params;

  const pluginConfig = configPortletifier.getPluginConfig();

  PortletMixiner.call(this, {
    portletDescriptors: lodash.get(pluginConfig, PORTLETS_COLLECTION_NAME),
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
};

Handler.referenceHash = {
  configPortletifier: "portletifier",
  tracelogService: "app-tracelog/tracelogService",
  mongoManipulator: "mongojs#manipulator"
};

module.exports = Handler;
