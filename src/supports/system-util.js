"use strict";

const mkdirp = require("mkdirp");
const rimraf = require("rimraf");

function createDir (dirPath) {
  return mkdirp(dirPath);
}

function removeDir (dirPath) {
  const { L, T } = this || {};
  return new Promise(function(resolve, reject) {
    rimraf(dirPath, function(err) {
      if (err) {
        L && L.has("silly") && L.log("silly", T && T.add({
          name: err.name,
          message: err.message
        }).toMessage({
          text: " - the /upload cleanup has been error: ${name} - ${message}"
        }));
        reject(err);
      } else {
        L && L.has("silly") && L.log("silly", T && T.toMessage({
          text: " - the /upload cleanup has been successful"
        }));
        resolve(dirPath);
      }
    });
  });
}

module.exports = { createDir, removeDir };
