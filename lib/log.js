/**
 * Logging helper class.
 */
const moment = require('moment');
const stackTrace = require('stack-trace');
const config = require('./config');
// const mail = require('./mail'); // leaving out email functionality for now
const os = require('os');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// replaceable info logger
var infoLogger;

const timeFormatFn = function () {
  if (!config.server.logTimes) return;
  return '[' + moment().toISOString() + ']';
};

// build winston instance for error logging
var errorLogger = new winston.Logger({
  exitOnError: false,
  transports: [
    new DailyRotateFile({
      filename: 'bpi.error.log',
      dirname: __dirname + '/../log',
      timestamp: timeFormatFn,
      json: false,
      level: config.server.logLevel
    }),
    new winston.transports.Console({
      colorize: true,
      timestamp: timeFormatFn,
      level: config.server.logLevel
    })
  ]
});

// build winston instance for info logging
module.exports.createInfoLogger = function () {
  infoLogger = new winston.Logger({
    exitOnError: false,
    transports: [
      new DailyRotateFile({
        filename: 'bpi.access.log',
        dirname: __dirname + '/../log',
        timestamp: timeFormatFn,
        json: false,
        level: config.server.logLevel
      }),
      new winston.transports.Console({
        colorize: true,
        timestamp: timeFormatFn,
        level: config.server.logLevel
      })
    ]
  });
};

/**
 * Use for informational messages that aren't too spammy.  Info messages are
 * always displayed.
 * 
 * @param {String} msg Log message to display
 */
module.exports.info = function (msg) {
  var out = buildOutput(msg);
  infoLogger.info(out);
};

/**
 * Use for errors or unexpected results.  Error messages are always displayed.
 * 
 * @param {String} msg Log message to display
 */
module.exports.error = function (msg) {
  var out = buildOutput(msg);
  // mail.sendError(out + '\n\nHost: ' + os.hostname());
  errorLogger.error(out);
};

/**
 * Use to help with debugging.  Debug messages are only displayed when
 * config.server.debug is true.
 * @param {String} msg Log message to display
 */
module.exports.debug = function (msg) {
  var out = buildOutput(msg);
  infoLogger.debug(out);
};

/**
 * koa middleware for logging web requests to the access log
 */
module.exports.middleware = async function (ctx, next, tag) {
  await next();
  // ignore healthcheck route for logging
  if (ctx.request.url === '/healthcheck') {
    return;
  }
  var bodyLength = 0;
  try {
    bodyLength = typeof ctx.request.body == 'object' ?
      JSON.stringify(ctx.request.body).length :
      ctx.request.body.length;
  } catch (err) {
  }
  infoLogger.debug(
    '[' + tag + '] ' +
    ctx.request.method + ' ' +
    ctx.request.url + ' ' +
    ctx.response.status + ' ' +
    bodyLength + ' ' +
    ctx.request.header['user-agent']
  );
};

/**
 * Build output line with timestamp and originating file/line number
 * 
 * @param  {String} msg Log message to display
 * @return {String}     Line to ultimately print in debug log
 */
function buildOutput(msg) {
  var trace = stackTrace.get();
  var caller = trace[2];
  var file, line;
  if (caller) {
    var path = caller.getFileName();
    var pieces = path.split('/');
    file = pieces[pieces.length - 1];
    line = caller.getLineNumber();
  }
  var out = '';
  // out += config.server.hostname + ' gdax ';
  if (file && line) {
    out += '[' + file + ':' + line + '] ';
  }
  out += msg;
  return out;
}

exports.createInfoLogger();
