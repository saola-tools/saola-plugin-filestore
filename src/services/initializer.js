"use strict";

const Devebot = require("devebot");
const lodash = Devebot.require("lodash");

function Service (params = {}) {
  const { packageName, sandboxConfig, errorManager } = params;

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });

  const legacyErrorStringEnabled = lodash.get(sandboxConfig, "legacyErrorStringEnabled");
  const legacyErrorStringMappings = lodash.get(sandboxConfig, "legacyErrorStringMappings");
  const legacyErrorStringSize = lodash.size(legacyErrorStringMappings);

  this.newError = function(name, opts) {
    if (legacyErrorStringEnabled && legacyErrorStringSize > 0) {
      const errorString = legacyErrorStringMappings[name];
      if (errorString) {
        return errorString;
      }
    }
    return errorBuilder.newError(name, opts);
  };
}

Service.referenceHash = {
  errorManager: "app-errorlist/manager"
};

module.exports = Service;
