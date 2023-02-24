"use strict";

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const lodash = FRWK.require("lodash");

function Servlet (params = {}) {
  const { sandboxConfig, sandboxRegistry, secretValueInvoker, mongoManipulator } = params;

  const { secretsManagerLocation } = sandboxConfig;
  const secretsManager = sandboxRegistry.lookupService(secretsManagerLocation);

  this.start = function() {
    let p = Promise.resolve();
    if (lodash.isFunction(mongoManipulator.setup) && secretValueInvoker) {
      p = secretValueInvoker.loadSecretValue({ secretsManager }).then(function(secretStore) {
        return mongoManipulator.setup({ secretsManager, secretStore });
      });
    }
    return p;
  };

  this.stop = function() {
    let p = Promise.resolve();
    if (lodash.isFunction(mongoManipulator.teardown)) {
      p = Promise.resolve(mongoManipulator.teardown());
    }
    return p.then(function() {
      return mongoManipulator.close();
    });
  };
};

Servlet.referenceHash = {
  mongoManipulator: "mongojs#manipulator",
  sandboxRegistry: "@saola/core/sandboxRegistry",
  secretValueInvoker: "@saola/plugin-secrets-hub/invoker",
};

module.exports = Servlet;
