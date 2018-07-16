/**
 * Runs jobs as soon as possible with a maximum concurrency
 */
const config = require('./config');
const log = require('./log');
const queue = require('queue');
const events = require('events');
const EventEmitter = events.EventEmitter;
const queue_listener = new EventEmitter();
const promisify = require('es6-promisify');
const request = promisify(require('request'));
const utility = require('./utility');

// queue default configuration
var q = queue({
  timeout: 30000,
  concurrency: 10,
  autostart: true,
});

// properties to give to info api route
exports.info = {
  concurrency: 0,
  errorRetries: 0,
  lastJobId: 0,
  success: 0,
  queued: 0,
  retries: 0,
  timeouts: 0,
  errors: 0,
}

var lastAlert = new Date();

// update info and pass to info api route, and check for queue maxed out
exports.getInfo = function () {
  exports.info.queued = q.length;
  exports.info.concurrency = q.concurrency;
  if (q.length > config.thresholds.maxQueue) {
    let now = new Date();
    if (utility.getMsBetween(lastAlert, now) > config.delays.resendAlert) {
      log.error(q.length + ' jobs are queued. Check whether a problem, such as bitcoind not responding, is stopping jobs from processing.');
      lastAlert = now;
    }
  }
  return exports.info;
}

// use to test for rpc timeout changes
var lastRpcTimeout;

// q.emit('success', result, job)
q.on('success', function(result, job) {
  queue_listener.emit('success-'+job.id, result);
});

// q.emit('error', err, job)
q.on('error', function(err, job) {
  queue_listener.emit('error-'+job.id, err);
});

// q.emit('timeout', continue, job)
q.on('timeout', function(next, job) {
  queue_listener.emit('timeout-'+job.id);
  next();
});

/**
 * add a call to request to the queue
 */
exports.addRequest = function (opts) {
  try {
    // opts: qs, timeout, url, body, retryLimit, retryOnError
    opts.timeout = opts.timeout || 30000;
    opts.retryLimit = opts.retryLimit || 3;
    opts.retryQueue = opts.retryQueue || 3;
    // each job passes opts to request and returns result
    var job = function (cb) {
      try {
        request(opts)
        .then(function (results) {
          cb(null, results);
        })
        .catch(function (error) {
          cb(error);
        });
      } catch (err) {
        log.debug('err ****: ' + JSON.stringify(err));
        cb(err);
      }
    }
    // store the opts for debugging errors and timeouts
    job.opts = opts;
    return setupJob(job);
  } catch (err) {
    log.info('job id ' + job.id + ' failed with opts ' + JSON.stringify(opts));
    log.info(err.stack);
    exports.info.errors++;
    throw(err);
  }
}

/**
 * handles general job setup and adds job to queue
 */
function setupJob (job) {
  try {
    if (!job) {
      throw new Error('Must supply job to setupJob function');
    }
    // store the job id to match results to the correct job
    job.id = ++exports.info.lastJobId;
    // allow 3 timeouts before reporting error
    job.retries = 0;
    if (q.timeout !== config.timeouts.queue) {
      q.timeout = config.timeouts.queue;
    }
    // if (q.concurrency !== config.thresholds.concurrency) {
    //   q.concurrency = config.thresholds.concurrency;
    // }
    // return a promise to the callee
    return new Promise(function (resolve, reject) {
      // handle a success event from the queue
      function onSuccess (result) {
        try {
          resolve(result);
          removeListeners(job.id);
          exports.info.success++;
        } catch (err) {
          log.error(err.stack);
          reject(err);
          exports.info.errors++;
        }
      }
      // handle an error event from the queue
      function onError (err) {
        try {
          // retry if less timeouts than retryLimit
          if (job.opts.retryOnError && job.retries < job.opts.retryLimit) {
            job.retries++;
            exports.info.errorRetries++;
            // delay retry for response server to have some breathing room
            setTimeout(function () {
              q.push(job);
            }, job.opts.retryQueue || 3000);
            log.info('Retrying job ' + job.id + ' with opts ' + JSON.stringify(job.opts));
            return;
          }
          let optsMessage = '';
          optsMessage += ' errored with opts: ' + JSON.stringify(job.opts);
          if (err && err.stack) {
            reject('job id ' + job.id + optsMessage + '\nerror: ' + err.stack);
          } else {
            reject(new Error(err || 
              'job id ' + job.id + optsMessage + '\nerror: ' + JSON.stringify(err)));
          }
          removeListeners(job.id);
          exports.info.errors++;
        } catch (err) {
          log.error(err.stack);
          reject(err);
          exports.info.errors++;
        }
      }
      // handle a timeout event from the queue
      function onTimeout () {
        try {
          // retry if less timeouts than retryLimit
          if (job.retries < job.opts.retryLimit) {
            job.retries++;
            exports.info.retries++;
            // delay retry for response server to have some breathing room
            setTimeout(function () {
              q.push(job);
            }, job.opts.retryQueue || 3000);
            log.info('Retrying job ' + job.id + ' with opts ' + JSON.stringify(job.opts));
            return;
          }
          removeListeners(job.id);
          reject(
            new Error('job id ' + job.id + ' timed out with opts ' + JSON.stringify(job.opts))
          );
          exports.info.timeouts++;
        } catch (err) {
          reject(err);
          log.error(err.stack);
          exports.info.errors++;
        }
      }
      // removes listeners for a job once the result is received
      function removeListeners (jobId) {
        try {
          queue_listener.removeListener('success-'+jobId, onSuccess);
          queue_listener.removeListener('error-'+jobId, onError);
          queue_listener.removeListener('timeout-'+jobId, onTimeout);
        } catch (err) {
          log.error(err.stack);
          exports.info.errors++;
        }
      }
      queue_listener.on('success-'+job.id, onSuccess);
      queue_listener.on('error-'+job.id, onError);
      queue_listener.on('timeout-'+job.id, onTimeout);
      // add job to queue
      q.push(job);
    });
  } catch (err) {
    log.info('job id ' + job.id + ' failed with opts ' + JSON.stringify(job.opts));
    log.info(err.stack);
    exports.info.errors++;
    throw(err);
  }
}
