"use strict";

const path = require("path");

const contextPath = "/example";

module.exports = {
  plugins: {
    pluginFilestore: {
      contextPath: contextPath,
      uploadDir: path.join(__dirname, "../data"),
      thumbnailFrames: [
        [512, 200],
        [512, 288],
      ],
    },
    pluginLogtracer: {
      tracingPaths: [ contextPath ],
      tracingBoundaryEnabled: true,
    },
  }
};
