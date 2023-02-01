"use strict";

module.exports = {
  plugins: {
    pluginFilestore: {
      portlets: {
        default: {},
        manager: {}
      }
    },
    appWebserver: {
      portlets: {
        default: {},
        manager: {
          host: "0.0.0.0",
          port: 9797
        }
      }
    }
  }
};
