"use strict";

const path = require("path");
const signtrap = require("signtrap");

const Devebot = require("@saola/core").parseArguments(require.main === module);

const app = Devebot.launchApplication({
  appRootPath: __dirname
}, [
  {
    name: "@saola/plugin-filestore",
    path: path.join(__dirname, "../../../index.js")
  }
]);

if (require.main === module) {
  app.server.start().then(function() {
    signtrap(function(signal, err) {
      app.server.stop().then(function() {
        console.info("The server is terminated now!");
      });
    });
  });
}

module.exports = app;
