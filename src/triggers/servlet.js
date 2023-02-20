"use strict";

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");
const lodash = FRWK.require("lodash");

function Servlet (params = {}) {
  const { sandboxConfig, sandboxRegistry, mongoManipulator } = params;

  const { secretsManagerLocation } = sandboxConfig;
  const secretsManager = sandboxRegistry.lookupService(secretsManagerLocation);

  this.start = function() {
    let p = Promise.resolve();
    if (lodash.isFunction(mongoManipulator.setup)) {
      p = loadSecretValue({ secretsManager }).then(mongoManipulator.setup.bind(mongoManipulator));
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
  sandboxRegistry: "@saola/core/sandboxRegistry",
  mongoManipulator: "mongojs#manipulator"
};

function loadSecretValue (context) {
  const { secretsManager } = context || {};
  //
  let p = Promise.resolve();
  if (secretsManager && lodash.isFunction(secretsManager.getSecretValue)) {
    p = secretsManager.getSecretValue({
      transformer: function({ status, value, error }) {
        if (status < 0) {
          return null;
        }
        return value;
      }
    });
  }
  //
  return p.then(function(secretStore) {
    return lodash.assign(context, { secretStore });
  });
}

module.exports = Servlet;
