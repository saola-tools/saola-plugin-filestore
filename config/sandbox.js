module.exports = {
  plugins: {
    appFilestore: {
      contextPath: "/filestore",
      collections: {
        FILE: "files"
      },
      thumbnailMaxWidth: 16 * 50,
      thumbnailMaxHeight: 9 * 50,
      thumbnailFrames: [],
      errorCodes: {
        "FileIdNotFoundError": {
          message: "FileId not found",
          returnCode: 1701,
          statusCode: 404,
        },
        "FileIdMustNotBeEmptyError": {
          message: "FileId must be set value",
          returnCode: 1702,
          statusCode: 404,
        },
        "FileDataMustNotBeEmptyError": {
          message: "FileInfo is empty",
          returnCode: 1703,
          statusCode: 404,
        },
        "WidthMustNotBeEmptyError": {
          message: "Width must be set value",
          returnCode: 1711,
          statusCode: 404,
        },
        "WidthMustBeIntegerError": {
          message: "Width must be a positive integer",
          returnCode: 1712,
          statusCode: 404,
        },
        "WidthExceedsLimitError": {
          message: "Width exceeds the max width value",
          returnCode: 1713,
          statusCode: 404,
        },
        "HeightMustNotBeEmptyError": {
          message: "Height must be set value",
          returnCode: 1721,
          statusCode: 404,
        },
        "HeightMustBeIntegerError": {
          message: "Height must be a positive integer",
          returnCode: 1722,
          statusCode: 404,
        },
        "HeightExceedsLimitError": {
          message: "Height exceeds the max width value",
          returnCode: 1723,
          statusCode: 404,
        },
        "ThumbnailFrameIsMismatchedError": {
          message: "Thumbnail dimension (width x height) is not accepted",
          returnCode: 1730,
          statusCode: 404,
        },
      },
      legacyErrorStringMappings: {
        "FileIdNotFoundError": "fileId_not_found",
        "FileIdMustNotBeEmptyError": "fileId_is_empty",
        "FileDataMustNotBeEmptyError": "invalid_upload_fields",
        "HeightMustNotBeEmptyError": "height_is_empty",
        "WidthMustNotBeEmptyError": "width_is_empty",
      },
      legacyErrorStringEnabled: true,
    }
  },
  bridges: {
    mongojs: {
      appFilestore: {
        manipulator: {
          connection_options: {
            host: "127.0.0.1",
            port: "27017",
            name: "filestore"
          }
        }
      }
    }
  }
};
