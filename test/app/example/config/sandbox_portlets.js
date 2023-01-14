"use strict";

module.exports = {
  plugins: {
    appFilestore: {
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
