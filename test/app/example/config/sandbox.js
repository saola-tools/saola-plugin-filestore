var path = require('path');

var contextPath = '/example';

module.exports = {
  plugins: {
    appFilestore: {
      contextPath: contextPath,
      uploadDir: path.join(__dirname, '../data'),
      thumbnailFrames: [
        [512, 200],
        [512, 288],
      ],
    },
    appTracelog: {
      tracingPaths: [ contextPath ],
      tracingBoundaryEnabled: true,
    },
  }
};
