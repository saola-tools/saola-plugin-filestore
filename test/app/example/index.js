"use strict";

const path = require("path");
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
    const stop = function() {
      app.server.stop().then(function() {
        console.log("The server has been stopped.");
      });
    };
    process.on("SIGINT", stop);
    process.on("SIGQUIT", stop);
    process.on("SIGTERM", stop);
  });
}

module.exports = app;
