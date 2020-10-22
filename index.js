/*
 * Main program entry point
 */
const accounts = require("./lib/accounts");
const api_listener = require("./lib/api_listener");
const config = require("./lib/config");
const log = require("./lib/log");
const orders = require("./lib/orders");
const products = require("./lib/products");
const requests = require("./lib/requests");
const server = require("./server");
const trader = require("./lib/trader");

let listeners = [];

async function init() {
  try {
    await accounts.init();
    await products.init();
    await orders.init();
    requests.init();
    listeners.push(api_listener.listen(config.server.apiPort));
    log.info("*** Initialization Complete ***");
  } catch (err) {
    log.error(err.stack);
    exitProcess();
  }
}

init();

async function shutDown() {
  setTimeout(function () {
    // ensure exit within a few seconds if await takes a while
    exitProcess();
  }, 2000);
  config.server.shuttingDown = true;
  // cancel any pending gdax orders while shutting down
  if (config.gdax.cancelOnShutdown) {
    log.info("canceling open orders on gdax");
    orders.cancelAll();
  }
  // stop the api listeners
  if (listeners.length) {
    let numClosed = 0;
    // close the API listener cleanly after all requests complete
    listeners.forEach(function (listener) {
      listener.close(function () {
        numClosed++;
        if (numClosed == listeners.length) {
          log.info("Listeners closed");
        }
      });
      setImmediate(function () {
        listener.emit("close");
      });
    });
  }
  // give processes an extra moment to complete
  setTimeout(function () {
    exitProcess();
  }, 1000);
}

function exitProcess() {
  process.exit();
}

process.on("SIGTERM", function () {
  shutDown();
});

process.on("SIGINT", function () {
  shutDown();
});

process.on("unhandledRejection", (reason, p) => {
  log.debug("Unhandled Rejection at: Promise", p, "reason:", reason);
  log.debug(reason.stack);
  // application specific logging, throwing an error, or other logic here
});
