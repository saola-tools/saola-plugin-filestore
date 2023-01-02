"use strict";

const os = require("os");

const devebot = require("devebot");
const Promise = devebot.require("bluebird");
const lodash = devebot.require("lodash");
const chores = devebot.require("chores");
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
    blockRef: "app-filestore/service",
    tmpRootDir: os.tmpdir() + "/devebot/filestore"
  };

  describe("createDir()", function() {
    let Handler, createDir;

    beforeEach(function() {
      Handler = mockit.acquire("service", serviceLocation);
      createDir = mockit.get(Handler, "createDir");
    });

    it("mkdirp raises an error [EPERM: operation not permitted]", function() {
      return createDir("/bin/abcd")
        .then(function(result) {
          assert.fail("This function call must raise an Error");
        })
        .catch(function(err) {
          assert.equal(err.name, "Error");
          assert.equal(err.message, "EPERM: operation not permitted, mkdir '/bin/abcd'");
          // OperationalError: EPERM: operation not permitted, mkdir '/bin/abcd'
        })
    });
  });

  describe("getMimeType()", function() {
    let Handler, getMimeType;

    beforeEach(function() {
      Handler = mockit.acquire("service", serviceLocation);
      getMimeType = mockit.get(Handler, "getMimeType");
    });

    it("mimeType is detected from the extension part of the filename", function() {
      const testcases = [
        {
          nameOrPath: "nothing",
          mimeType: "application/octet-stream",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "/bin/mkdir",
          mimeType: "application/octet-stream",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.apng",
          mimeType: "image/apng",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.avif",
          mimeType: "image/avif",
          tags: ["latest"]
        },
        {
          nameOrPath: "something.gif",
          mimeType: "image/gif",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.png",
          mimeType: "image/png",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: path.join(__dirname, "../../", "lab/images/logbeat.png"),
          mimeType: "image/png",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.jpg",
          mimeType: "image/jpeg",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.jpeg",
          mimeType: "image/jpeg",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.jfif",
          mimeType: "image/jpeg",
          tags: ["latest"]
        },
        {
          nameOrPath: "something.pjpeg",
          mimeType: "image/jpeg",
          tags: ["latest"]
        },
        {
          nameOrPath: "something.pjp",
          mimeType: "image/jpeg",
          tags: ["latest"]
        },
        {
          nameOrPath: "something.svg",
          mimeType: "image/svg+xml",
          tags: ["1.6.0", "latest"]
        },
        {
          nameOrPath: "something.webp",
          mimeType: "image/webp",
          tags: ["1.6.0", "latest"]
        },
      ];
      //
      const selectedCases = lodash.filter(testcases, function(testcase) {
        return testcase.tags.includes("1.6.0");
      });
      //
      for (const testcase of selectedCases) {
        const detectedMime = getMimeType(testcase.nameOrPath);
        assert.equal(detectedMime, testcase.mimeType, JSON.stringify({
          nameOrPath: testcase.nameOrPath, mimeType: testcase.mimeType, detectedMime
        }));
      }
    })
  });

  describe("createUploadMiddleware()", function() {
    const context = lodash.merge({}, ctx);

    let Handler, createUploadMiddleware;

    beforeEach(function() {
      Handler = mockit.acquire("service", serviceLocation);
      createUploadMiddleware = mockit.get(Handler, "createUploadMiddleware");
    });

    it("ok", function() {
      const middleware = createUploadMiddleware(context);
      middleware();
    })
  });
});
