const _ = require('lodash');
const config = require('./config');
const log = require('./log');
const math = require('mathjs');
const accounts = require('./accounts');
const products = require('./products');
const orders = require('./orders');
const requests = require('./requests');
const utility = require('./utility');

const addRound8 = utility.addRound8;
const subRound8 = utility.subRound8;

let currencies = [];
for (let currency in config.accounts) {
  currencies.push(currency);
}

/*
todo log the prices of each filled buy in array form [61.99, 62.2, etc]
log total value in btc, total value in ltc, like $ is done
*/
let logDelayTime = 500000; // log stats periodically, based on this time
let logDelays = {};
for (let productId in config.products) {
  logDelays[config.products[productId]] = null; // timer for automatic stat logging
}

exports.init = function () {
  setTimeout(function () {
    for (let productId in config.products) {
      exports.log(productId, '[timer]');
    }
  }, 1000);
}

exports.log = function (productId, caller) {
  
  caller = caller || '';
  let stats = exports.get(productId);
  log.info('[logStats] ' + caller + ' ' + productId + '\n' + JSON.stringify(stats, null, 2) + '\n');
}

exports.getConvertedBalances = async function () {
  try {
    let results = {
      original: { actual: {}, conversions: {} },
      current: { actual: {}, holding: {}, conversions: {} },
    };
    let currencies = {};
    for (let currency in accounts.accounts) {
      let account = accounts.accounts[currency];
      currencies[account.currency] = account.currency; // { BTC: BTC, etc }
      results.original.actual[currency] = 0;
      results.original.conversions[currency] = {};
      results.current.holding[currency] = {};
      results.current.actual[currency] = 0;
      results.current.conversions[currency] = {};
    }
    //   original: {
    //     actual: {
    //       USD: 0,
    //       BTC: 0,
    //       ETH: 0,
    //       LTC: 0,
    //     },
    //     conversions: {
    //       USD: {},
    //       BTC: {},
    //       ETH: {},
    //       LTC: {},
    //     },
    //   },
    //   current: {
    //     actual: {
    //       USD: 0,
    //       BTC: 0,
    //       ETH: 0,
    //       LTC: 0,
    //     },
    //     holding: {
    //       USD: {},
    //       BTC: {},
    //       ETH: {},
    //       LTC: {},
    //     },
    //     conversions: {
    //       USD: {},
    //       BTC: {},
    //       ETH: {},
    //       LTC: {},
    //     },
    //   },
    // };
    let tickers = {};
    for (let currency in accounts.accounts) {
      let account = accounts.accounts[currency];
      results.current.actual[currency] = account.balance; // current actual currency
      results.current.conversions[currency][currency] = account.balance; // current conversions currency currency
      let product, ticker, price;
      // set original balance
      results.original.actual[currency] = config.accounts[currency].originalBalance; // original actual currency
      // set original USD conversion (price * balance)
      results.original.conversions.USD[currency] = utility.multRound8(config.accounts[currency].originalPrice || 1, config.accounts[currency].originalBalance); // original conversions USD currency
      results.original.conversions[currency][currency] = config.accounts[currency].originalBalance; // origina conversions currency currency
      results.current.holding[currency][currency] = config.accounts[currency].originalBalance; // origina holding currency currency
      if (currency === 'USD') {
        results.current.holding.USD.USD = results.original.actual.USD; // current holding currency currency
        for (let key in currencies) {
          if (key === 'USD') continue;
          productId = key + '-USD';
          product = products.products[productId];
          if (product) {
            price = product.ticker.price;
            tickers[productId] = product.ticker;
          } else {
            // get the ticker
            ticker = await products.getProductTicker(productId);
            tickers[productId] = ticker;
            price = ticker.price;
          }
          // convert usd to key
          results.current.conversions[key].USD = utility.divRound8(account.balance, price); // conversions other USD
          // holding other USD
          results.current.holding[key].USD = utility.divRound8(config.accounts[currency].originalBalance, price);
        }
      } else {
        // currency in account, not USD, fill in USD
        productId = currency + '-USD';
        if (tickers[productId]) {
          price = tickers[productId].price;
        } else {
          product = products.products[productId];
          if (product) {
            price = product.ticker.price;
            tickers[productId] = product.ticker;
          } else {
            // get the ticker
            ticker = await products.getProductTicker(productId);
            tickers[productId] = ticker;
            price = ticker.price;
          }
        }
        // convert currency to USD
        results.current.conversions.USD[currency] = utility.multRound8(account.balance, price);
        // convert currency to USD
        results.current.holding.USD[currency] = utility.multRound8(config.accounts[currency].originalBalance, price);
      }
    }
    // fill in coin conversions (USD is done)
    for (let currency in currencies) {
      let usdValue = results.current.conversions.USD[currency];
      for (let k in currencies) {
        if (k === 'USD' || currency === k) continue;
        let productId = k + '-USD';
        let ticker = tickers[productId];
        results.current.conversions[k][currency] = utility.divRound8(usdValue, ticker.price);
        // fill in original conversion
        let origPrice = config.accounts[k].originalPrice || 1;
        results.original.conversions[k][currency] = utility.divRound8(results.original.conversions.USD[currency], origPrice);
        // fill in original holding
        results.current.holding[k][currency] = utility.divRound8(results.original.conversions.USD[currency], ticker.price); // current holding currency
      }
    }
    // set up totals
    for (let section in results) {
      for (let currency in currencies) {
        for (let k in currencies) {
          // add the converted sections
          results[section].conversions[currency].total = results[section].conversions[currency].total || 0;
          results[section].conversions[currency].total = utility.addRound8(results[section].conversions[currency].total, results[section].conversions[currency][k] || 0);
          if (section === 'current') {
            results[section].holding[currency].total = results[section].holding[currency].total || 0;
            // total += this key value
            results[section].holding[currency].total = utility.addRound8(results[section].holding[currency].total, results[section].holding[currency][k] || 0);
          }
        }
      }
    }
    // set up gains
    for (let currency in results.current.conversions) {
      results.current.conversions[currency].gain = utility.subRound8(results.current.conversions[currency].total, results.original.conversions[currency].total);
      // current conversion total - holding conversion total
      results.current.holding[currency].gain = utility.subRound8(results.current.conversions[currency].total, results.current.holding[currency].total);
    }
    return results;
  } catch (err) {
    log.error(err.stack || err);
  }
}

exports.get = function (productId) { 
  try {
    if (config.server.shuttingDown) return;
    
    if (!productId) {
      for (let pid in config.products) {
        productId = pid;
        break;
      }
    }
    let product = accounts.products[productId];
    if (!product) {
      return log.error('[get] trade data not found for ' + JSON.stringify(productId));
    }
    product.laststats = new Date();
    let currency = product.currency;
    let logDelay = logDelays[product.currency];
    if (logDelay) clearTimeout(logDelay); // reset log stats timer
    logDelay = setTimeout(function () { // log stats every once in a while
      exports.log(product.id); // log stats again after a delay
    }, logDelayTime);
    let stats = {
      currencies: {},
      fillCost: {
        all: 0,
      },
      gains: {},
      general: {
        lastBuyTime: utility.getTimeSince(product[side].lastFillTime),
        lastFillSide: utility.getTimeSince(product.lastFillSide),
        lastSellTime: utility.getTimeSince(product[side].lastFillTime),
        price: product.price,
        productId: product.id,
        rangeSize: product.rangeSize,
      },
      // prices: {
      //   highestFill: math.round(product.prices.highestFill, 2),
      //   highest: product.prices.highest,
      //   highestEver: product.prices.highestEver,
      //   lowestFill: math.round(product.prices.lowestFill, 2),
      //   lowest: product.prices.lowest,
      //   lowestEver: product.prices.lowestEver,
      //   middle: product.prices.middle,
      //   middleEver: product.prices.middleEver,
      // },
    };
    let allFillTotals = 0;
    let otherCoinsValue = 0; // $ in other coins current holdings current value
    let otheroriginalHoldings = 0; // $ in other coins original holdings current value
    let otherFillHoldings = 0; // $ in other coins at purchase value
    stats.currencies.ALL = {
      current: 0,
      original: 0,
      holding: 0,
    };
    stats.currencies.USD = {
      current: {},
      original: {},
      holding: {},
    };
    let current = stats.currencies.USD.current;
    let original = stats.currencies.USD.original;
    let holding = stats.currencies.USD.holding;
    let otherproduct = accounts.accounts.USD;
    return stats;
  } catch (err) {
    log.error(err.stack);
  }
}