"use strict";

function Service (params = {}) {
  const { packageName, sandboxConfig, errorManager } = params;

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });

  const errorStringMappings = {
    "FileIdIsEmptyError": "fileId_is_empty",
    "FileIdNotFoundError": "fileId_not_found",
    "EmptyFileDataError": "invalid_upload_fields",
    "HeightMustNotBeEmptyError": "height_is_empty",
    "WidthMustNotBeEmptyError": "width_is_empty",
  };

  this.newError = function(name, opts) {
    const errorString = errorStringMappings[name];
    if (errorString) {
      return errorString;
    }
    return errorBuilder.newError(name, opts);
  };
}

Service.referenceHash = {
  errorManager: "app-errorlist/manager"
};

module.exports = Service;
