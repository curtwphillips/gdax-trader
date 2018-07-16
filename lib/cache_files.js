const fs = require('fs');
const log = require('./log');
const config = require('./config');
const utility = require('./utility');

/**
 * Track whether processes are running
 */
var isRunning = {};

/**
 * Read exchange file to get latest exchange data
 * @param string fileName
 */
exports.getFile = async function (fileName) {
  try {
    if (config.server.shuttingDown) {
      return;
    }
    if (!fileName) {
      throw new Error('Get cache file missing file name: ' + fileName);
    }
    file = await utility.readFile(__dirname + '/../cache/' + fileName);
    return JSON.parse(file);
  } catch (err) {
    try {
      if (err.code !== 'ENOENT') {
        // if the error is something other than the file not existing
        log.info(err.stack || 'error: ' + err);
        log.info('There was an error getting ' + fileName);
      } else {
        log.info('--- The cache file ' + fileName + ' was not found. ---');
      }
      if (!fileName.startsWith('backup_')) {
        log.info('--- Checking backup exchange cache file ' + fileName + ' ---');
        await exports.getFile('backup_'+fileName);
      } else {
        log.info('--- The exchange cache files were unusable. ---');
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // if the error is something other than the file not existing
        log.info(err.stack || 'There was an error getting ' + fileName + ', error: ' + err);
      } else {
        log.info('--- The cache file was not found. ---');
      }
      log.info('--- The exchange cache files were unusable. ---');
    }
  }
}

/**
 * Store latest exchange data to file
 * @param string fileName
 * @param obj data 
 */
exports.writeFile = async function (fileName, data) {
  try {
    if (config.server.shuttingDown) {
      return;
    }
    if (!fileName) {
      throw new Error('Write to cache file missing file name, data: ' + JSON.stringify(data));
    }
    // don't allow a second write to start while writing to files
    if (isRunning.fileName) {
      return;
    }
    isRunning.fileName = true;
    var text = getFileText(data);

    // delete the text of the current file
    await utility.truncateFile(__dirname+'/../cache/'+fileName, 0);
    
    var source = __dirname + '/../cache/' + fileName;
    var target = __dirname + '/../cache/backup_'+fileName;

    var writeStream = fs.createWriteStream(source);

    writeStream.on('finish', function() {
      if (config.server.shuttingDown) {
        return;
      }
      // backup file after writes
      utility.copyFileCb(source, target, function (err) {
        if (err) {
          log.error('Failed to write ' + text + ' to ' + fileName + ': ' + err);
        }
      });
    });
    writeStream.write(text);
    writeStream.end();
  } catch (err) {
    log.info('Failed to write ' + text + ' to ' + fileName);
    log.error(err.stack);
    isRunning.fileName = false;
  } finally {
    isRunning.fileName = false;
  }
}

// data should be an object with number values for each key to use this function, {key1: #, key2: #}
function getFileText (data) {
  let text = '{';
  // count determines whether or not a comma is needed
  let count = 0;
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      if (count > 0) {
        text += ',';
      }
      if (data[key] !== null && typeof data[key] === 'object') {
        text += '"' + key + '":' + JSON.stringify(data[key]);
      } else {
        text += '"' + key + '":' + data[key];
      }
    }
    count++;
  }
  text += '}';
  return text;
}
