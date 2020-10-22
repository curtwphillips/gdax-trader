const os = require("os");
const _ = require("lodash");
const config = require("./config");
const log = require("./log");
const accounts = require("./accounts");
const utility = require("./utility");
const stats = require("./stats");
const serverStarted = new Date();
const cpus = os.cpus().length;
const sockets = require("./sockets");

exports.get = function () {
  try {
    const loadAverages = utility.loadavg(2);
    const results = {
      general: {
        hostname: os.hostname(),
        running: utility.getTimeSince(serverStarted),
        time: utility.getTime(),
        load: loadAverages[0], // loadPastMinute
      },
    };

    results.switches = {};
    results.delays = {};
    results.thresholds = {};
    // convert to string so that falsy values shows in response
    for (let key in config.delays) {
      results.delays[key] = config.delays[key].toLocaleString();
    }
    for (let key in config.thresholds) {
      results.thresholds[key] = config.thresholds[key].toString();
    }

    // results.stats = stats.get();
    for (let id in accounts.products) {
      let product = accounts.products[id];
      results[id] = _.omit(product, [
        "ticker",
        "orders",
        "buy",
        "sell",
        "stats",
        "config",
        "awaiting",
        "first",
        "possible",
        "onPriceOnce",
      ]);

      results[id + "_ticker"] = product.ticker;
      results[id + "_config"] = product.config;
      results[id + "_buy_orders"] = product.orders.buy;
      results[id + "_sell_orders"] = product.orders.sell;
    }

    return results;
  } catch (err) {
    log.error(err.stack);
  }
};
