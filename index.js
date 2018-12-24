'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Formats any file at the path supplied or *.json file in any directory or sub directory if the path is a directory
 * @name formatJsonFiles
 * @param {String} pathArgument - A file or directory path
 */
module.exports = function (pathArgument) {
  processPathForJsonFileFormatting(pathArgument);

  function processPathForJsonFileFormatting(targetPath) {
    if (!targetPath) {
      throw new Error('Path argument not set');
    }

    if (typeof targetPath !== 'string') {
      throw new TypeError('Target path argument is not a string');
    }

    if (isExistingFilePath(targetPath)) {
      formatJsonFile(targetPath);

      return;
    }

    if (isExistingDirectoryPath(targetPath)) {
      formatDirectoryJsonFiles(targetPath);

      return;
    }

    throw new Error('Invalid path');
  }

  function formatDirectoryJsonFiles(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
      throw new Error('Directory path ' + directoryPath + ' does not exist.  Can\'t parse.');
    }

    const files = fs.readdirSync(directoryPath);

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];

      const filename = path.join(directoryPath, entry);

      const stat = fs.lstatSync(filename);

      if (stat.isDirectory()) {
        formatDirectoryJsonFiles(filename);
      } else if (isAJsonFileName(filename)) {
        formatJsonFile(filename);
      }
    }
  }

  function formatJsonFile(filePath) {
    try {
      const deserializedObject = readJsonFileToObject(filePath);

      writeFormattedJsonToPath(deserializedObject, filePath);
    } catch (error) {
      console.log('Error processing target file: ' + filePath + ', skipping.');
      console.log('Original Error: ' + error);
    }
  }
  function isAJsonFileName(fileName) {
    if (!fileName) {
      return false;
    }

    const lowerCasedFileName = fileName.toLowerCase();

    return lowerCasedFileName.endsWith('.json');
  }

  function isExistingFilePath(targetPath) {
    return fs.existsSync(targetPath) && fs.lstatSync(targetPath).isFile();
  }

  function isExistingDirectoryPath(targetPath) {
    return fs.existsSync(targetPath) && fs.lstatSync(targetPath).isDirectory();
  }

  function readJsonFileToObject(targetPath) {
    const fileText = fs.readFileSync(targetPath);
    try {
      return JSON.parse(fileText);
    } catch (error) {
      if (error instanceof SyntaxError) {
        const message = 'Syntax Error processing file: `' + targetPath + '`. Triggering Error: ' + error;

        throw new Error(message);
      }
    }
  }

  function writeFormattedJsonToPath(targetObj, targetPath) {
    const serializedObject = JSON.stringify(targetObj, null, 4);

    fs.writeFileSync(targetPath, serializedObject);
  }
};
