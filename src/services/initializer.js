"use strict";

const FRWK = require("@saola/core");
const lodash = FRWK.require("lodash");

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
  errorManager: "@saola/plugin-errorlist/manager"
};

module.exports = Service;
