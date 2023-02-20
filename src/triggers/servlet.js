"use strict";

const FRWK = require("@saola/core");
const Promise = FRWK.require("bluebird");

function Servlet (params = {}) {
  const { mongoManipulator } = params;

  this.start = function() {
    return Promise.resolve();
  };

  this.stop = function() {
    return Promise.resolve(mongoManipulator.close());
  };
};

Servlet.referenceHash = {
  mongoManipulator: "mongojs#manipulator"
};

module.exports = Servlet;
