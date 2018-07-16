const config = require('./config');
const log = require('./log');
const accounts = require('./accounts');
const requests = require('./requests');
const utility = require('./utility');
exports.products = {};

exports.init = async function () {
  let products = await requests.authed('getProducts');
  for (let productId in config.products) {
    let productData;
    for (let i = 0; i < products.length; i++) {
      if (products[i].id === productId) {
        productData = products[i];
        break;
      }
    }
    if (!productData) throw new Error('No product data found for ' + productId);
    exports.products[productId] = productData;
    let product = exports.products[productId];
    product.config = config.products[productId];
    product.baseAccount = accounts.accounts[product.base_currency],
    product.quoteAccount = accounts.accounts[product.quote_currency],
    product.buy = {};
    product.sell = {};
    product.orders = {
      buy: {},
      sell: {},
    };
    log.info(productId + ' enabled');
  }
}

// get ticker with recursive calls if needed
exports.getProductTicker = async function (productId) {
  let ticker = await requests.public('getProductTicker', productId);
  if (!ticker || !ticker.price) {
    let ms = 5000;
    log.info('Ticker price not found. Retrying in ' + ms + ' ms, ticker: ' + JSON.stringify(ticker));
    await utility.sleep(ms);
    return exports.getProductTicker(productId);
  }
  return ticker;
}
