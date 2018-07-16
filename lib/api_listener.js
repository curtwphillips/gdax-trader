/**
 * Sets up a koa endpoint to listen to API requests.
 * Listen port is set in config.js under server.apiPort.
 */
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const router = require('koa-router')();
const log = require('./log');
const config = require('./config');
const utility = require('./utility');
const info = require('./info');
const stats = require('./stats');
const validLogLevels = ['debug', 'info'];
const app = new Koa();

/**
 * Adjust configuration and state without restart.
 *
 * All calls can be run with: 
 * curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig
 * where an appropriate object is in between the '' marks. Examples are in comments before each section.
 */
router.post('/reconfig', async function (ctx) {
  try {
    var changes = '';
    var body = ctx.request.body;
    var keys = Object.keys(body);

/*
curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig
EXAMPLES:
curl -H "Content-Type: application/json" -X POST -d '{"config":{"products":{"LTC-BTC":{"buy":{"maxSize": 10}}}}}' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '{"config":{"products":{"LTC-BTC":{"sell":{"maxSize": 10}}}}}' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '{"config":{"products":{"LTC-BTC":{"buy":{"minSize": 10}}}}}' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '{"config":{"products":{"LTC-BTC":{"sell":{"minSize": 10}}}}}' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig
curl -H "Content-Type: application/json" -X POST -d '' 127.0.0.1:3344/reconfig

{"config":{"thresholds":{"concurrency":2}}}
{"config":{"timeouts":{"queue":6000}}}
*/
    if (keys.indexOf('config') !== -1) {
      traverseConfig(body.config, config);
    }

    function traverseConfig (o, conf) {
      // go through each key in o and match it with a key in conf
      for (let i in o) {
        let oIsObj = (o[i] !== null && typeof(o[i])=="object") || Array.isArray(o[i]);
        let confIsObj = (conf[i] !== null && typeof(conf[i])=="object") || Array.isArray(conf[i]);
        if (oIsObj && confIsObj) {
          // if both keys are for objects, go deeper
          traverseConfig(o[i], conf[i]);
        } else if (!(o[i] !== null && typeof(o[i])=="object") && !(conf[i] !== null && typeof(conf[i])=="object")) {
          // if neither key is an object, set the config property
          changes += 'Changed config ' + i + ' from ' + conf[i] + ' to ' + o[i]+'\n';
          conf[i] = o[i];
        } else {
          // if one key is an object and the other is not, this change should not be made
          let theObject;
          if (oIsObj) {
            theObject = 'body';
          } else {
            theObject = 'config'
          }
          changes += i+' in '+theObject+' is an object.\nNot setting\n' + JSON.stringify(conf[i]) + '\nto '+JSON.stringify(o[i])+'\n';
        }
      }
    }

// {"logLevel":"debug"}
    if (keys.indexOf('logLevel') !== -1) {
      if (validLogLevels.indexOf(body.logLevel) !== -1) {
        config.server.logLevel = body.logLevel;
        log.createInfoLogger();
        changes += 'logLevel set to ' + body.logLevel + '\n';
      } else {
        changes += 'logLevel cannot be set to ' + body.logLevel + '\n';
      }
    }

    ctx.body = '\n' + changes + '    \n';

  } catch (err) {
    log.info('curl /reconfig route error with post body: ' + JSON.stringify(body) + ', err: ' + err.stack);
    ctx.body = '\nreconfig error: ' + JSON.stringify(err) + '\n';
  }
});

// check instance information endpoint
// curl 127.0.0.1:3344/info
router.get('/info', async function (ctx) {
  try {
    var results = info.get();
    ctx.body = '\n' + JSON.stringify(results, null, 2) + '    \n\n';
  } catch(err) {
    ctx.statusCode = 500;
    ctx.body = '\n' + JSON.stringify({error: err.message}) + '    \n\n';
  }
});

// check instance information endpoint
// curl 127.0.0.1:3344/getConvertedBalances
router.get('/getConvertedBalances', async function (ctx) {
  try {
    var results = await stats.getConvertedBalances();
    ctx.body = '\n' + JSON.stringify(results) + '    \n\n';
  } catch(err) {
    ctx.statusCode = 500;
    ctx.body = '\n' + JSON.stringify({error: err.message}) + '    \n\n';
  }
});

app
  .use(bodyParser())
  .use(async (ctx, next) => await log.middleware(ctx, next, 'API'))
  .use(router.routes())
  .use(router.allowedMethods());

log.debug('Listening on port ' + config.server.apiPort);
module.exports = app;
