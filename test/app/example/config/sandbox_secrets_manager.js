"use strict";

const lib = require("../../../index");

module.exports = {
  plugins: {
    pluginFilestore: {
      secretsManagerLocation: "application/secretsManager#mongoCredentials",
    }
  },
  bridges: {
    secretsManager: {
      application: {
        mongoCredentials: {
          region: "ap-southeast-1",
          secretId: lib.getSecretIdOf("documentdb"),
          defaultOnErrors: [ "*" ],
          defaultValue: null,
        },
      }
    }
  }
};
