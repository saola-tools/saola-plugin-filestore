"use strict";

const os = require("os");
const fs = require("fs").promises;

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const lodash = FRWK.require("lodash");
const chores = FRWK.require("chores");
const { assert, mockit } = require("liberica");
const path = require("path");
const util = require("util");

const serviceLocation = { libraryDir: "../lib" };

describe("filestoreService", function() {
  const sandboxConfig = {};

  const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
  const ctx = {
    L: loggingFactory.getLogger(),
    T: loggingFactory.getTracer(),
    blockRef: "@saola/plugin-filestore/service",
    tmpRootDir: os.tmpdir() + "/saola-plugin-filestore"
  };

  describe("createDir()", function() {
    let Service, createDir;

    beforeEach(function() {
      Service = mockit.acquire("service", serviceLocation);
      createDir = mockit.get(Service, "createDir");
    });

    it("mkdirp raises an error [EPERM: operation not permitted]", function() {
      return createDir("/bin/abcd").then(function(result) {
        assert.fail("This function call must raise an Error");
      }, function(err) {
        assert.equal(err.name, "Error");
        assert.equal(err.message, "EPERM: operation not permitted, mkdir '/bin/abcd'");
        // OperationalError: EPERM: operation not permitted, mkdir '/bin/abcd'
      });
    });
  });

  function inspectDir (dir) {
    return fs.stat(dir).then(function(stats) {
      const result = lodash.pick(stats, [
        "dev", "mode", "uid", "gid", "size", "atime", "mtime", "ctime", "nlink"
      ]);
      //
      if (stats.isDirectory()) {
        result.isDirectory = true;
        result.isFile = false;
      }
      if (stats.isFile()) {
        result.isDirectory = false;
        result.isFile = true;
      }
      //
      return result;
    });
  }

  describe("removeDir()", function() {
    const testDirPath = "/tmp/@saola/plugin-filestore-test";
    let Service, createDir, removeDir;

    beforeEach(function() {
      Service = mockit.acquire("service", serviceLocation);
      createDir = mockit.get(Service, "createDir");
      removeDir = mockit.get(Service, "removeDir");
    });

    it("A directory is removed successfully", function() {
      let p = createDir(testDirPath).then(function(result) {
        false && console.log("createDir: %s", result);
        return inspectDir(testDirPath);
      }, function(err) {
        assert.fail("This function call must raise an Error");
      });
      //
      p = p.then(function(info) {
        assert.isTrue(info.isDirectory);
      }, function(err) {
        assert.fail("This function call must raise an Error");
      });
      //
      p = p.then(function() {
        return removeDir(testDirPath);
      });
      //
      p = p.then(function(removedDirPath) {
        assert.equal(removedDirPath, testDirPath);
      }, function(err) {
        assert.fail("This function call must raise an Error");
      });
      //
      return p;
    });
  });

  describe("getMimeType()", function() {
    let Service, getMimeType;

    beforeEach(function() {
      Service = mockit.acquire("handler", serviceLocation);
      getMimeType = mockit.get(Service, "getMimeType");
    });

    it("mimeType is detected from the extension part of the filename", function() {
      const testcases = [
        {
          nameOrPath: "nothing",
          mimeType: "application/octet-stream",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "/bin/mkdir",
          mimeType: "application/octet-stream",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.apng",
          mimeType: "image/apng",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.avif",
          mimeType: "image/avif",
          tags: ["3.0.0", "latest"]
        },
        {
          nameOrPath: "something.gif",
          mimeType: "image/gif",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.png",
          mimeType: "image/png",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: path.join(__dirname, "../../", "lab/images/logbeat.png"),
          mimeType: "image/png",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.jpg",
          mimeType: "image/jpeg",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.jpeg",
          mimeType: "image/jpeg",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.jfif",
          mimeType: "image/jpeg",
          tags: ["mozilla"]
        },
        {
          nameOrPath: "something.pjpeg",
          mimeType: "image/jpeg",
          tags: ["mozilla"]
        },
        {
          nameOrPath: "something.pjp",
          mimeType: "image/jpeg",
          tags: ["mozilla"]
        },
        {
          nameOrPath: "something.svg",
          mimeType: "image/svg+xml",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
        {
          nameOrPath: "something.webp",
          mimeType: "image/webp",
          tags: ["1.6.0", "3.0.0", "latest"]
        },
      ];
      //
      const selectedCases = lodash.filter(testcases, function(testcase) {
        return testcase.tags.includes("3.0.0");
      });
      //
      for (const testcase of selectedCases) {
        const detectedMime = getMimeType(testcase.nameOrPath);
        assert.equal(detectedMime, testcase.mimeType, JSON.stringify({
          nameOrPath: testcase.nameOrPath, mimeType: testcase.mimeType, detectedMime
        }));
      }
    });
  });

  describe("createUploadMiddleware()", function() {
    const context = lodash.merge({}, ctx);

    let Service, createUploadMiddleware;

    beforeEach(function() {
      Service = mockit.acquire("service", serviceLocation);
      createUploadMiddleware = mockit.get(Service, "createUploadMiddleware");
    });

    it("ok", function() {
      const middleware = createUploadMiddleware(context);
      middleware();
    });
  });
});
