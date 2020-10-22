/**
 * Make requests
 */

const config = require("./config");
const log = require("./log");
const queue_requests = require("./queue_requests");

/**
 * Adds requests to the queue and returns result body if no error
 */
exports.makeRequest = async function (opts) {
  try {
    let result = await queue_requests.addRequest(opts);
    if (opts.currency === "ltc") {
      log.debug("opts: " + JSON.stringify(opts));
      log.debug("\n\n");
      log.debug(JSON.stringify(result));
      log.debug("\n");
    }
    if (result.statusCode != 200) {
      if (!result.body.includes("not found")) {
        log.error(
          "request failed with opts: " +
            JSON.stringify(opts) +
            ", result: " +
            JSON.stringify(result)
        );
      }
      return;
    }
    const body = JSON.parse(result.body);
    if (body.error) {
      log.error(
        "REQUEST error in makeRequest: " +
          JSON.stringify(body.error) +
          ", opts: " +
          JSON.stringify(opts)
      );
      return;
    }

    return body;
  } catch (err) {
    log.error("opts: " + JSON.stringify(opts) + ", err: " + err.stack);
  }
};

exports.getTransaction = async function (currency, txid) {
  let baseUrl;
  if (currency === "btc") {
    baseUrl = "https://blockchain.info/rawtx/";
  } else if (currency === "ltc") {
    baseUrl = "https://insight.litecore.io/tx/";
  } else {
    return log.error(
      "Unrecognized currency: " + currency + " for txid: " + txid
    );
  }
  // opts: qs, timeout, url, body, retryLimit, retryOnError
  let opts = {
    currency: currency,
    url: baseUrl + txid,
    timeout: 30000,
  };
  opts.timeout = opts.timeout || 30000;
  opts.retryLimit = opts.retryLimit || 3;
  return await exports.makeRequest(opts);
};
