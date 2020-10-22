/**
 * Generic and commonly used functions
 */
const os = require("os");
const fs = require("fs");
const moment = require("moment");
const log = require("./log");
const math = require("mathjs");

// number of bytes in a GB
const bytesInGB = 1073741824;

exports.missingKeys = function (obj, keys) {
  const missing = [];
  for (let i = 0; i < keys.length; i++) {
    if (typeof obj[keys[i]] == "undefined") {
      missing.push(keys[i]);
    }
  }
  if (missing.length) {
    return missing;
  }
  return false;
};

// return load averages for 1 minute, 5 minutes, and 15 minutes at set precision
// return value [number, number, number]
exports.loadavg = function (precision) {
  const load = os.loadavg();
  for (let i = 0; i < load.length; i++) {
    load[i] = setPrecision(load[i], precision);
  }
  return load;
};

// return load averages for past minute at set precision
exports.getLoadPastMinute = function () {
  const loadAverages = exports.loadavg(2);
  return loadAverages[0];
};

// get free memory in bytes or converted form
exports.freeMemory = function (convertTo) {
  return convertBytes(os.freemem(), convertTo);
};

// get total memory in bytes or converted form
exports.totalMemory = function (convertTo) {
  return convertBytes(os.totalmem(), convertTo);
};

function setPrecision(val, precision) {
  if (!precision && precision !== 0) {
    return val;
  }
  return val.toFixed(precision);
}

function convertBytes(bytes, type, precision) {
  if (!type) {
    return bytes;
  }
  if (!precision && precision !== 0) {
    precision = 2;
  }
  if (type === "GB") {
    return setPrecision(bytes / bytesInGB, precision);
  } else {
    return "unrecognized type for conversion from bytes";
  }
}

// return true if all keys in obj are empty or empty arrays
exports.allKeysEmpty = function (obj) {
  const keys = Object.getOwnPropertyNames(obj);
  for (let i = 0; i < keys.length; i++) {
    if (Array.isArray(obj[keys[i]])) {
      if (obj[keys[i]].length) {
        break;
      }
    } else {
      if (obj[keys[i]]) {
        break;
      }
    }
    // all keys empty
    if (i === keys.length - 1) {
      return true;
    }
  }
  return false;
};
// return number of keys in object
exports.keysCount = function (obj, skipHasOwnProperty) {
  let count = 0;
  if (skipHasOwnProperty) {
    for (let key in obj) {
      ++count;
    }
  } else {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        ++count;
      }
    }
  }
  return count;
};

/**
 * format current time or date object, ex. "09-07-15, 5:45:16.321 pm"
 * if null is passed in, it returns the current date time
 */
exports.getTime = function (dateObject) {
  return moment(dateObject).format("MM-DD-YY h:mm:ss a"); // h:mm:ss.SSS
};

/**
 * round a number down with a specified number of decimals left over
 */
exports.round = function (value, decimals) {
  value = Number.parseFloat(value);
  decimals = decimals || 0;
  return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
};

/**
 * round a number up with a specified number of decimals left over
 */
exports.roundUp = function (value, decimals) {
  decimals = decimals || 0;
  return Number(Math.ceil(value + "e" + decimals) + "e-" + decimals);
};

/**
 * round a number down with a specified number of decimals left over
 */
exports.roundDown = function (value, decimals) {
  decimals = decimals || 0;
  return Number(Math.floor(value + "e" + decimals) + "e-" + decimals);
};

// subtract using integers to avoid things like 0.000131 - 0.000022 equaling 0.00010900000000000002 instead of 0.000109
exports.doMath = function (type, val1, val2) {
  val1 = Number.parseFloat(val1);
  val2 = Number.parseFloat(val2);
  const types = ["add", "subtract"];
  if (types.indexOf(type) === -1) {
    throw new Error(
      "utility.doMath requires one of these types: " +
        types +
        ", but received type: " +
        type
    );
  }
  if (isNaN(val1) || isNaN(val2)) {
    throw new Error(
      "utility.doMath only accepts numbers, but received val1 " +
        val1 +
        " of type " +
        typeof val1 +
        " and val2 " +
        val2 +
        " of type " +
        typeof val2
    );
  }

  const stringValue1 = val1.toString();
  const stringValue2 = val2.toString();

  // check for scientific notation, convert to decimal
  if (stringValue1.indexOf("e-") !== -1) {
    val1 = exports.convertScientificToDecimal(val1);
  }
  if (stringValue2.indexOf("e-") !== -1) {
    val2 = exports.convertScientificToDecimal(val2);
  }

  const val1Decimals = exports.countDecimals(val1);
  const val2Decimals = exports.countDecimals(val2);

  const biggerDecimals = Math.max(val1Decimals, val2Decimals);

  // convert both values to integers
  const tempVal1 = Number(val1 + "e" + biggerDecimals);
  const tempVal2 = Number(val2 + "e" + biggerDecimals);

  let tempAnswer;

  if (type === "subtract") {
    tempAnswer = tempVal1 - tempVal2;
  } else if (type === "add") {
    tempAnswer = tempVal1 + tempVal2;
  }

  // move decimal back to correct place
  return Number(tempAnswer + "e-" + biggerDecimals);
};

exports.countDecimals = function (value) {
  if (value % 1 !== 0) {
    return value.toString().split(".")[1].length;
  }
  return 0;
};

function copyFile(source, target, cb) {
  let cbCalled = false;
  const rd = fs.createReadStream(source);
  rd.on("error", function (err) {
    done(err);
  });
  const wr = fs.createWriteStream(target);
  wr.on("error", function (err) {
    done(err);
  });
  wr.on("close", function (ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (err) {
      log.error("err: " + JSON.stringify(err));
    }
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}

// copy file, calls a callback
exports.copyFileCb = function (source, target, cb) {
  let cbCalled = false;
  const rd = fs.createReadStream(source);
  rd.on("error", function (err) {
    done(err);
  });
  const wr = fs.createWriteStream(target);
  wr.on("error", function (err) {
    done(err);
  });
  wr.on("close", function (ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (err) {
      log.error("[utility.js] copyFileCb error: " + JSON.stringify(err));
    }
    if (cb && !cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
};

// copy file, returns a promise
exports.copyFile = function (source, target) {
  return new Promise(function (resolve, reject) {
    const rd = fs.createReadStream(source);
    rd.on("error", rejectCleanup);
    const wr = fs.createWriteStream(target);
    wr.on("error", rejectCleanup);
    function rejectCleanup(err) {
      rd.destroy();
      wr.end();
      reject(new Error(err));
    }
    wr.on("finish", function () {
      resolve();
    });
    rd.pipe(wr);
  });
};

const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
exports.getDaysBetween = function (firstDate, secondDate) {
  // add one to result to include partial day
  return Math.floor(
    Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay)
  );
};

exports.getMsBetween = function (firstDate, secondDate) {
  try {
    const result = Math.floor(
      Math.abs(firstDate.getTime() - secondDate.getTime())
    );
    return result;
  } catch (err) {
    log.debug("firstDate: " + firstDate + ", secondDate: " + secondDate);
    log.error(err);
  }
};

/*
 * returns time since a passed in date object
 */
exports.getTimeSince = function (pastDateObject) {
  if (!pastDateObject) {
    return;
  }
  let timeAgo, seconds, minutes;
  const msInSecond = 1000;
  const msInMinute = 60000;
  const msInHour = 3600000;
  const msInDay = 86400000;
  const now = new Date();
  const msBetween = exports.getMsBetween(now, pastDateObject);
  if (msBetween <= msInMinute) {
    timeAgo = Math.floor(msBetween / msInSecond) + " secs";
  } else if (msBetween <= msInHour) {
    timeAgo = Math.floor(msBetween / msInMinute) + " mins";
  } else if (msBetween <= msInDay) {
    timeAgo = Math.floor(msBetween / msInHour) + " hrs";
  } else {
    timeAgo = Math.floor(msBetween / msInDay) + " days";
  }
  return timeAgo;
};

exports.truncateFile = async function (path, start) {
  start = start || 0;
  return new Promise(function (resolve) {
    fs.truncate(path, start, function (err) {
      resolve();
    });
  });
};

exports.readFile = async function (path) {
  try {
    return new Promise(function (resolve, reject) {
      fs.readFile(path, function (err, data) {
        if (err) {
          reject(new Error(err));
        } else {
          resolve(data);
        }
      });
    });
  } catch (err) {
    log.error(err.stack);
  }
};

/**
 * convert scientific notation to decimal
 */
exports.convertScientificToDecimal = function (value) {
  if (isNaN(value)) {
    throw new Error("The value " + value + " is not a number");
  }

  strNum = value.toString().toLowerCase();

  // check for each part of the notation
  const decimalIndex = strNum.indexOf(".");
  let eIndex = strNum.indexOf("e-");
  let exponChars;

  // determine if moving decimal right or left
  if (eIndex === -1) {
    eIndex = strNum.indexOf("e");
    exponChars = 1;
  } else {
    exponChars = 2;
  }

  if (eIndex === -1) {
    return num;
  }

  let left, right;

  // gather the numbers from each side of the decimal
  if (decimalIndex !== -1) {
    left = strNum.slice(0, decimalIndex);
    right = strNum.slice(decimalIndex + 1, eIndex);
  } else {
    left = strNum.slice(0, eIndex);
    right = "";
  }

  // get the exponent
  const expon = strNum.slice(eIndex + exponChars, strNum.length);

  let zeroCount, newStrNum, i;

  // add zeros as needed
  if (exponChars === 2) {
    zeroCount = expon - left.length;
    newStrNum = ".";
    for (i = 0; i < zeroCount; i++) {
      newStrNum += "0";
    }
    newStrNum += left + right;
  } else {
    zeroCount = expon - right.length;
    newStrNum = left + right;
    for (i = 0; i < zeroCount; i++) {
      newStrNum += "0";
    }
    newStrNum += left + right;
  }

  return newStrNum;
};

exports.firstExisting = function (obj, prop1, prop2) {
  if (obj) {
    if (obj[prop1] || obj[prop1] === 0) {
      return obj[prop1];
    } else {
      return obj[prop2];
    }
  }
};

exports.hexIfBuffer = function (buffer) {
  if (buffer instanceof Buffer) {
    return buffer.toString("hex");
  } else {
    return buffer;
  }
};

exports.randAlphNum = function (len) {
  let result = "";
  let options =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < len; i++) {
    result += options.charAt(Math.floor(Math.random() * options.length));
  }
  return result;
};

exports.getRandomIntInclusive = function (min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
};

exports.sleep = async function (ms) {
  return new Promise((r) => setTimeout(r, ms));
};

exports.sortNumbersFn = function (a, b) {
  return a - b;
};

exports.parseFloatObject = function (obj, propsArray) {
  for (let i = 0; i < propsArray.length; i++) {
    let prop = propsArray[i];
    let result = Number.parseFloat(obj[prop]);
    if (isNaN(result)) {
      // log.debug('Property ' + prop + ' of obj ' + JSON.stringify(obj) + ' isNaN');
      continue;
    }
    obj[prop] = result;
  }
  return obj;
};

exports.toFixedTrunc = function (value, n) {
  const v = value.toString().split(".");
  if (n <= 0) return v[0];
  let f = v[1] || "";
  if (f.length > n) return `${v[0]}.${f.substr(0, n)}`;
  while (f.length < n) f += "0";
  return Number.parseFloat(`${v[0]}.${f}`);
};

exports.logRequest = async function (ctx, next) {
  const start = new Date();
  if (
    Object.keys(ctx.request.body).length !== 0 &&
    ctx.request.body.constructor === Object
  ) {
    const bod = _.omit(ctx.request.body, "password");
    if (ctx.request.body.password) {
      bod.password = "<redacted>";
    }
    log.debug(ctx.method + " " + ctx.url + " body: " + JSON.stringify(bod));
  }
  if (
    Object.keys(ctx.request.query).length !== 0 &&
    ctx.request.query.constructor === Object
  ) {
    const qbod = _.omit(ctx.request.query, "password");
    if (ctx.request.query.password) {
      qbod.passord = "<redacted>";
    }
    log.debug(ctx.method + " " + ctx.url + " query: " + JSON.stringify(qbod));
  }
  await next();
  const ms = new Date() - start;
  log.debug(`${ctx.method} ${ctx.url} - ${ms}ms`);
};

exports.nearestMod = function (val, mod) {
  val = Number.parseFloat(val);
  return math.round(math.multiply(Math.round(math.divide(val, mod)), mod), 8);
};

exports.subFloor8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return exports.floor8(math.subtract(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.addFloor8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return exports.floor8(math.add(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.divFloor8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return exports.floor8(math.divide(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.multFloor8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return exports.floor8(math.multiply(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.subRound8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return math.round(math.subtract(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.addRound8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return math.round(math.add(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.divRound8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return math.round(math.divide(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.multRound8 = function (v1, v2) {
  try {
    if (isNaN(v1) || isNaN(v2)) {
      log.debug("v1: " + v1 + ", v2: " + v2);
    }
    return math.round(math.multiply(v1, v2), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.floor8 = function (val) {
  try {
    if (isNaN(val)) {
      log.debug(val);
    }
    return exports.toFixedTrunc(math.round(val, 9), 8);
  } catch (err) {
    log.error(err.stack);
  }
};
exports.round8 = function (val) {
  try {
    if (isNaN(val)) {
      log.debug(val);
    }
    return math.round(val, 8);
  } catch (err) {
    log.error(err.stack);
  }
};

exports.runEveryMsAsync = function (ms, fn) {
  setInterval(fn, ms);
};
