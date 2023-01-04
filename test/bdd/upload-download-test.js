"use strict";

const Devebot = require("devebot");
const Promise = Devebot.require("bluebird");
const chores = Devebot.require("chores");
const path = require("path");
const { assert, mockit, sinon } = require("liberica");

const { uploadFile, downloadFile, sampleFileContents } = require("../lib/file-http-handler");
const app = require("../example");

describe("app.server", function() {
  before(function() {
    chores.setEnvironments({
      DEVEBOT_FORCING_SILENT: "devebot,webserver",
      LOGOLITE_FULL_LOG_MODE: "false",
      LOGOLITE_ALWAYS_ENABLED: "all",
      LOGOLITE_ALWAYS_MUTED: "all"
    });
  });
  //
  after(function() {
    chores.clearCache();
  });
  //
  describe("upload and download general files", function() {
    const fileId = "612d388f-0569-427f-88ad-257e52a3b1a5";
    const originalFilePath = path.join(__dirname, "../lab/images/logbeat.png");
    const thumbnailFilePath = path.join(__dirname, "../lab/images/logbeat-512x200.png");
    const downloadedFilePath = path.join(__dirname, "../tmp/download-logbeat.png");
    const outputThumbnailPath = path.join(__dirname, "../tmp/thumbnail-logbeat.png");
    beforeEach(function() {
      return Promise.resolve().then(app.server.start).delay(100);
    });
    //
    afterEach(function() {
      return app.server.stop();
    });
    //
    it("Upload a file to the filestore", function() {
      const url = "http://localhost:7979/example/upload/";
      return uploadFile(url, originalFilePath, fileId);
    });
    //
    it("Download a file from the filestore", function() {
      const url = `http://localhost:7979/example/download/${fileId}`;
      return downloadFile(url, downloadedFilePath);
    });
    //
    it("Downloaded file must be the same as the original file", function() {
      return sampleFileContents(downloadedFilePath, originalFilePath).then(function(result) {
        assert.isTrue(result);
        return result;
      });
    });
    //
    it("Download a file from the filestore", function() {
      const url = `http://localhost:7979/example/download/unknown`;
      return downloadFile(url, downloadedFilePath)
        .then(function() {
          assert.fail("This request must raise an error");
        })
        .catch(function(err) {
          false && console.log(err);
          assert.equal(err.response.status, 404);
        });
    });
  });
  //
  describe("upload images - download thumbnails", function() {
    const fileId = "612d388f-0569-427f-88ad-257e52a3b1a5";
    const originalFilePath = path.join(__dirname, "../lab/images/logbeat.png");
    const thumbnailFilePath = path.join(__dirname, "../lab/images/logbeat-512x200.png");
    const downloadedFilePath = path.join(__dirname, "../tmp/download-logbeat.png");
    const outputThumbnailPath = path.join(__dirname, "../tmp/thumbnail-logbeat.png");
    beforeEach(function() {
      return Promise.resolve().then(app.server.start).delay(100);
    });
    //
    afterEach(function() {
      return app.server.stop();
    });
    //
    it("Download a thumbnail from the filestore", function() {
      const url = `http://localhost:7979/example/picture/${fileId}/512/200`;
      return downloadFile(url, outputThumbnailPath);
    });
    //
    it("Thumbnail image must be the same as the original thumbnail", function() {
      return sampleFileContents(outputThumbnailPath, thumbnailFilePath).then(function(result) {
        assert.isTrue(result);
        return result;
      });
    });
  });
});
