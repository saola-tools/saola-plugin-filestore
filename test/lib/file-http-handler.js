"use strict";

const fs = require("fs");
const stream = require('stream');
const util = require("util");

const finished = util.promisify(stream.finished);

const axios = require("axios");
const FormData = require('form-data');

function uploadFile (uploadTargetUrl, fileLocationPath, fileId) {
  let formData = new FormData();
  formData.append("data", fs.createReadStream(fileLocationPath));
  if (fileId) {
    formData.append('fileId', fileId);
  }
  //
  // return axios.request({
  //   url: uploadTargetUrl,
  //   method: 'POST',
  //   headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  //   data: formData
  // }).catch(function (err) {
  //   console.log("Error: ", err);
  //   return Promise.reject(err);
  // });
  return axios.post(uploadTargetUrl, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    }
  }).catch(function (err) {
    console.log("Error: ", err);
    return Promise.reject(err);
  });
}

function downloadFile (fileUrl, outputLocationPath) {
  const writer = fs.createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    response.data.pipe(writer);
    return finished(writer);
  });
}

function sampleFileContents (file1, file2) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file1, (err, data1) => {
      if (err) return reject(err);
      fs.readFile(file2, (err, data2) => {
        if (err) return reject(err);
        if (data1.equals(data2)) {
          return resolve(true);
        } else {
          return resolve(false);
        }
      });
    });
  });
}

module.exports = { uploadFile, downloadFile, sampleFileContents };
