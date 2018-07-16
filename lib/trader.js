/*
 * The main trading logic
 */
const _ = require('lodash');
const config = require('./config');
const log = require('./log');
const math = require('mathjs');
const orders = require('./orders');
const products = require('./products');
const utility = require('./utility');
const addFloor8 = utility.addFloor8;
const subFloor8 = utility.subFloor8;
const divFloor8 = utility.divFloor8;
const multFloor8 = utility.multFloor8;
const floor8 = utility.floor8;
const addRound8 = utility.addRound8;
const subRound8 = utility.subRound8;
const divRound8 = utility.divRound8;
const multRound8 = utility.multRound8;
const round8 = utility.round8;
let trackingNumber = 0;

/*
 * Checks whether to Buy or Sell as price uproductates are received
 */
exports.onPrice = async function (productId, ticker) { // LTC-USD 60.51, LTC-BTC .0085
  try {
    var opts;
    if (config.server.shuttingDown) return;
    var premsg = '[onPrice] ' + productId;

    var product = products.products[productId];
    // limit rate of submitting orders, for instance only allow 1 order every 20 seconds
    let now = new Date();
    if (config.gdax.delayPrice && product.lastOrderStarted) {
      let msFromLast = utility.getMsBetween(product.lastOrderStarted, now);
      if (msFromLast < config.gdax.delayPrice) return;
      log.debug(premsg + ' price delay is set to ' + config.gdax.delayPrice + 'ms');
    }
    product.lastOrderStarted = now;
    if (product.inProgress) return;
    trackingNumber++;
    product.inProgress = true;
    product.ticker = ticker; // {price: , best_bid: , best_ask: , ask: , etc...}
    let increment = config.products[productId].increment || 0.001;
    // store data in opts throughout the price check to avoid other prices mutating it
    opts = {
      product: product,
      trackingNumber: trackingNumber,
      increment: increment,
      precision: utility.countDecimals(increment),
    };

    log.debug('*** ' + opts.trackingNumber + ' STARTING ON PRICE');
    opts.useSize = getUseSize(opts);
    await setRanges(opts, 'buy'); // fill in any missing buy spots
    await setRanges(opts, 'sell'); // fill in any missing sell spots
  } catch (err) {
    log.error(err.stack);
  } finally {
    product.inProgress = false;
    if (opts && opts.trackingNumber) {
      log.debug('*** ' + opts.trackingNumber + ' END ON PRICE');
    }
  }
}

async function setRanges (opts, side) {
  try {
    let premsg = '[setRanges] ' + opts.trackingNumber + ' ' + opts.product.id + ' ' + side + ', $' + opts.product.ticker.price + ', ';
    if (!opts.product.config[side].on) return;
    log.debug('*** ' + opts.trackingNumber + ' START SET RANGES ' + side.toUpperCase());
    let otherSide = side === 'buy' ? 'sell' : 'buy';
    opts[side] = {
      maxPrice: opts.product.config[side].maxPrice,
      minPrice: opts.product.config[side].minPrice,
      maxSize: opts.product.config[side].maxSize || opts.product.base_max_size,
      minSize: opts.product.config[side].minSize || opts.product.base_min_size,
      useSize: opts.useSize,
    };

    setTooHighPrice(opts, side);
    setTooLowPrice(opts, side);

    log.debug(side + ' opts[side].tooHighPrice: ' + opts[side].tooHighPrice + ', opts[side].tooLowPrice: ' + opts[side].tooLowPrice + ', opts.product[side].lastFillPrice: '+ opts.product[side].lastFillPrice + ', opts.product[otherSide].lastFillPrice: ' + opts.product[otherSide].lastFillPrice + ', opts.product[side].lastFillTime: ' + opts.product[side].lastFillTime + ', opts.product[otherSide].lastFillTime: ' + JSON.stringify(opts.product[otherSide].lastFillTime));
    // ensure qty < max
    if (opts[side].maxSize && opts[side].useSize > opts[side].maxSize) opts[side].useSize = opts[side].maxSize;
    // ensure qty > min
    if (opts[side].minSize && opts[side].useSize < opts[side].minSize) opts[side].useSize = opts[side].minSize;
    // ensure price < max
    if (opts[side].maxPrice && opts[side].tooHighPrice > opts[side].maxPrice) opts[side].tooHighPrice = opts[side].maxPrice;
    // ensure price > min
    if (opts[side].minPrice && opts[side].tooLowPrice < opts[side].minPrice) opts[side].tooLowPrice = opts[side].minPrice;

    if (side === 'buy') {
      // buy price should be as high as possible within limits
      // get base price near the max
      log.debug('opts[side].tooHighPrice: ' + opts[side].tooHighPrice + ', opts.increment: ' + opts.increment);
      opts[side].basePrice = utility.nearestMod(opts[side].tooHighPrice, opts.increment);
      // make sure it's below the max
      if (opts[side].basePrice >= opts[side].tooHighPrice) {
        opts[side].basePrice = subRound8(opts[side].basePrice, opts.increment);
      }
      // don't sell too many to keep min hold balance
      if (opts.product.quoteAccount.config.minBalance) {
        opts[side].minBalance = divFloor8(opts.product.quoteAccount.config.minBalance, opts[side].basePrice);
      } else {
        opts[side].minBalance = 0;
      }
      log.debug(side + ' minBalance: ' + opts[side].minBalance + ', opts.product.quoteAccount.balance: ' + opts.product.quoteAccount.balance + ', opts[side].basePrice: ' + opts[side].basePrice);
      opts[side].balance = divFloor8(opts.product.quoteAccount.balance, opts[side].basePrice);
      // use balance, not available
      log.debug(side + ' bal: ' + opts[side].balance + ', minBal: ' + opts[side].minBalance);
      opts[side].available = subFloor8(opts[side].balance, opts[side].minBalance);
      log.debug(side + ' opts[side].available: ' + opts[side].available);
    } else { // side === 'sell'
      // sell price should be as low as possible within limits
      // get base price near the min
      opts[side].basePrice = utility.nearestMod(opts[side].tooLowPrice, opts.increment);
      // make sure it's above the min
      if (opts[side].basePrice <= opts[side].tooLowPrice) {
        opts[side].basePrice = addRound8(opts[side].basePrice, opts.increment);
      }
      // don't sell too many to keep min hold balance
      opts[side].minBalance = opts.product.baseAccount.config.minBalance || 0;
      log.debug(side + ' minBalance: ' + opts[side].minBalance);
      opts[side].balance = floor8(opts.product.baseAccount.balance);
      // use balance, not available
      opts[side].available = subFloor8(opts[side].balance, opts[side].minBalance);
      log.debug(side + ' available: ' + opts[side].available);
    }

    if (opts[side].useSize > opts[side].available) {
      if (opts[side].available >= opts[side].minSize) {
        opts[side].useSize = opts[side].available;
      } else {
        return log.info(premsg + 'STOP STOP STOP STOP STOP, balance is too low, balance: ' + opts[side].balance + ', available: '  + opts[side].available + ', minBalance: ' + opts[side].minBalance + ', minSize: ' + opts[side].minSize);
      }
    } else if (opts[side].boostedSize && opts[side].boostedSize > opts[side].useSize) {
      // we don't hold much, boost orders to get more. for ltc boost buys, for btc boost sells
      opts[side].useSize = opts[side].boostedSize;
      // make sure size didn't get above max size
      if (opts.maxSize && opts[side].useSize > opts.maxSize) opts[side].useSize = opts.maxSize;
      log.debug(side + ' boosted size to ' + opts[side].useSize);
    }
    log.debug('*** side: ' + side);
    // 10 BTC / .0091 Rate / 5 LTC_Use_Size), 219 buys possible
    // 10 LTC / 5 LTC_Use_Size, 2 sells possible
    opts[side].possible = Math.floor(math.divide(opts[side].available, opts[side].useSize));

    // only allow configured max orders, if it exists
    opts[side].maxOrders = opts.product.config.maxOrders;
    if (opts[side].maxOrders && opts[side].possible > opts[side].maxOrders) {
      opts[side].possible = opts[side].maxOrders;
    }

    if (side === 'buy') {
      opts[side].cancelEdgePrice = subRound8(opts[side].basePrice, math.multiply(opts.increment, math.subtract(opts[side].possible, 1)));
      opts[side].cancelEdgePrice = utility.toFixedTrunc(opts[side].cancelEdgePrice, opts.precision);
    } else {
      opts[side].cancelEdgePrice = addRound8(opts[side].basePrice, math.multiply(opts.increment, math.subtract(opts[side].possible, 1)));
      opts[side].cancelEdgePrice = utility.toFixedTrunc(opts[side].cancelEdgePrice, opts.precision);
    }
    opts[side].ordersCount = 0;
    opts[side].ordersSizeSum = 0;

    if (opts[side].possible < 1) {
      log.debug(premsg + 'No orders possible: ' + opts[side].possible);
    }

    log.debug('*** side: ' + side);
    // go through each price increment, if order not already there, create it
    for (let i = 0; i < opts[side].possible; i++) {
      if (side === 'buy') {
        opts[side].incrementedPrice = subRound8(opts[side].basePrice, math.multiply(opts.increment, i));
      } else { // side === 'sell'
        opts[side].incrementedPrice = addRound8(opts[side].basePrice, math.multiply(opts.increment, i));
      }
      opts[side].incrementedPrice = math.round(opts[side].incrementedPrice, opts.precision);

      // Create the order
      await orders.create(opts, side);
      
      opts[side].ordersCount++;
      opts[side].ordersSizeSum = addRound8(opts[side].ordersSizeSum, opts[side].useSize);
    }
    // cancel orders out of range
    // log.debug(premsg + 'cancelEdgePrice: ' + opts.cancelEdgePrice + ', possible: ' + opts.possible);
    let wereCanceled = await orders.cancelOutsideRange(opts, side, opts[side].cancelEdgePrice);
  } catch (err) {
    log.error(err.stack);
  } finally {
    log.debug('*** ' + opts.trackingNumber + ' FINALLY SET RANGES ' + side.toUpperCase());
  }
}

function getQuoteUnheldBalanceConverted (opts) {
  return divFloor8(opts.product.quoteAccount.balance, opts.product.ticker.price);
}

function getBaseUnheldBalance (opts) {
  return subFloor8(opts.product.baseAccount.balance, opts.product.baseAccount.config.minBalance || 0);
}

function moreRecent (date1, date2) {
  if (!date1) return;
  if (!date2) return true;
  return date1 > date2;
}

/**
 * lp+(r-lr)*(hp-lp)/(hr-lr) = p
 * p = unknown percent
 * hp = rate
 * lp = low percent
 * y = high percent
 * lr = low rate
 * hr = high rate
 */
function getRateHoldPercent (opts, side, rate) {
  let lowPercent = opts.product.config.lowPercent;
  let highPercent = opts.product.config.highPercent;
  let lowRate = opts.product.config.lowRate;
  let highRate = opts.product.config.highRate;
  // (r - lr)
  let aboveRangeFloor = subFloor8(rate, lowRate);
  // (hp - lp)
  let percentRange = subFloor8(highPercent, lowPercent);
  // (hr - lr)
  let priceRange = subFloor8(highRate, lowRate);
  let percentRanged = multRound8(aboveRangeFloor, percentRange);
  let priceRanged = divRound8(percentRanged, priceRange);

  // let scaleFactor = divRound8(priceRange, percentRange);
  log.debug(side + ', rate: ' + rate + ', lowPercent: ' + lowPercent + ', highPercent: ' + highPercent + ', lowRate: ' + lowRate + ', highRate: ' + highRate + ', aboveRangeFloor: ' + aboveRangeFloor + ', percentRange: ' + percentRange + ', priceRange: ' + priceRange + ', percentRanged: ' + percentRanged + ', percentRanged: ' + percentRanged);
  return addRound8(lowPercent, priceRanged);
}

/**
 * x+(p-A)*(y-x)/(B-A) = r
 * p = percent
 * r = unknown rate
 * A = low percent
 * B = high percent
 * x = low rate
 * y = high rate
 */
function getRateFromPercent (opts, side, percent) {
  let lowPercent = opts.product.config.lowPercent;
  let highPercent = opts.product.config.highPercent;
  let lowRate = opts.product.config.lowRate;
  let highRate = opts.product.config.highRate;
  log.debug(side + ' percent: ' + percent + ', lowPercent: ' + lowPercent + ', highPercent: ' + highPercent + ', lowRate: ' + lowRate + ', highRate: ' + highRate);
  return addRound8(lowRate, math.divide(math.multiply(math.subtract(percent, lowPercent), math.subtract(highRate, lowRate)), math.subtract(highPercent, lowPercent)));
}

/**
 * for buys. buys spend the quote account to get more of the base account
 * hold 90% at .005 and 10% at .02
 */
function setTooHighPrice (opts, side) {
  try {
    if (side === 'sell') return;
    let otherSide = 'sell';
    let quoteUnheldBalanceConverted = getQuoteUnheldBalanceConverted(opts);
    let baseUnheldBalance = getBaseUnheldBalance(opts);
    // you cannot limit buy for the best ask
    opts[side].tooHighPrice = opts.product.ticker.best_ask;
    // maintain a larger balance of quote currency as the rate increases
    let holdQuotePercent = getRateHoldPercent(opts, side, opts[side].tooHighPrice);
    let fullHeld = addRound8(baseUnheldBalance, quoteUnheldBalanceConverted);

    // check whether to boost buying
    if (opts.product.config.lowHeldPercent && opts.product.config.boost) {
      // check if low base currency held. if held is < total held * low held percent then low held and buy more
      let held = baseUnheldBalance;
      let lowHeld = multRound8(fullHeld, opts.product.config.lowHeldPercent);
      if (held < lowHeld) {
        // we don't hold much, boost orders to get more. for ltc boost buys, for btc boost sells
        opts[side].boostedSize = subRound8(lowHeld, held);
        log.debug('*** side: ' + side + ' using boost for held: ' + held + ', lowHeld: ' + lowHeld);
        // don't check other rules that limit the price
        return;
      }
    }

    let heldNeeded = multRound8(fullHeld, holdQuotePercent);
    if (heldNeeded > quoteUnheldBalanceConverted) {
      // find the lower rate that would be ok to buy at
      opts[side].tooHighPrice = Math.min(opts[side].tooHighPrice, getRateFromPercent(opts, side, divRound8(quoteUnheldBalanceConverted, fullHeld)));
    }
    log.debug(side + ' tooHighPrice: ' + opts[side].tooHighPrice + ', used quoteUnheldBalanceConverted: ' + quoteUnheldBalanceConverted + ', holdQuotePercent: ' + holdQuotePercent + ', fullHeld: ' + fullHeld + ', heldNeeded: ' + heldNeeded);
    // buy lower than last completed sell
    if (opts.product[otherSide].lastFillPrice) {
      if (opts[side].tooHighPrice > opts.product[otherSide].lastFillPrice) {
        opts[side].tooHighPrice = opts.product[otherSide].lastFillPrice;
      }
    }
    // if last buy is more recent than last sell, buy lower than last buy
    if (moreRecent(opts.product[side].lastFillTime, opts.product[otherSide].lastFillTime)) {
      if (opts[side].tooHighPrice > opts.product[side].lastFillPrice) {
        opts[side].tooHighPrice = opts.product[side].lastFillPrice;
      }
    }
    log.debug(side + ' tooHighPrice: ' + opts[side].tooHighPrice + ', used quoteUnheldBalanceConverted: ' + quoteUnheldBalanceConverted + ', holdQuotePercent: ' + holdQuotePercent + ', fullHeld: ' + fullHeld + ', heldNeeded: ' + heldNeeded);
  } catch (err) {
    log.error(err.stack);
  }
};

/**
 * sells spend the base account to get more of the quote account
 */
function setTooLowPrice (opts, side) {
  try {
    if (side === 'buy') return;
    let otherSide = 'buy';
    let baseUnheldBalance = getBaseUnheldBalance(opts);
    let quoteUnheldBalanceConverted = getQuoteUnheldBalanceConverted(opts);
    // you cannot limit sell for the best ask
    opts[side].tooLowPrice = opts.product.ticker.best_bid;
    // maintain a larger balance of quote currency as the rate increases
    let holdQuotePercent = getRateHoldPercent(opts, side, opts[side].tooLowPrice);
    let fullHeld = addRound8(baseUnheldBalance, quoteUnheldBalanceConverted);

    // check whether to boost selling
    if (opts.product.config.lowHeldPercent && opts.product.config.boost) {
      // check if low base currency held. if held is < total held * low held percent then low held and sell more
      let held = quoteUnheldBalanceConverted;
      let lowHeld = multRound8(fullHeld, opts.product.config.lowHeldPercent);
      if (held < lowHeld) {
        // we don't hold much, boost orders to get more. for ltc boost buys, for btc boost sells
        opts[side].boostedSize = subRound8(lowHeld, held);
        // don't check other rules that limit the price
        return;
      }
    }

    let heldNeeded = multRound8(fullHeld, holdQuotePercent);
    if (heldNeeded > quoteUnheldBalanceConverted) {
      // find the higher rate that would be ok to sell at
      opts[side].tooLowPrice = Math.max(opts[side].tooLowPrice, getRateFromPercent(opts, side, divRound8(quoteUnheldBalanceConverted, fullHeld)));
    }
    log.debug(side + ' tooLowPrice: ' + opts[side].tooLowPrice + ', used quoteUnheldBalanceConverted: ' + quoteUnheldBalanceConverted + ', holdQuotePercent: ' + holdQuotePercent + ', fullHeld: ' + fullHeld + ', heldNeeded: ' + heldNeeded);
    // sell higher than last completed buy
    if (opts.product[side].lastFillPrice) {
      if (opts[side].tooLowPrice < opts.product[otherSide].lastFillPrice) {
        opts[side].tooLowPrice = opts.product[otherSide].lastFillPrice;
      }
    }
    // if last sell is more recent than last buy, sell higher than last sell 
    if (moreRecent(opts.product[side].lastFillTime, opts.product[otherSide].lastFillTime)) {
      if (opts[side].tooLowPrice < opts.product[side].lastFillPrice) {
        opts[side].tooLowPrice = opts.product[side].lastFillPrice;
      }
    }
    log.debug(side + ' tooLowPrice: ' + opts[side].tooLowPrice + ', used quoteUnheldBalanceConverted: ' + quoteUnheldBalanceConverted + ', holdQuotePercent: ' + holdQuotePercent + ', fullHeld: ' + fullHeld + ', heldNeeded: ' + heldNeeded);
  } catch (err) {
    log.error(err.stack);
  }
};

/**
 * returns either combined balance, lower balance, or higher balance depending on configuration
 */
function getUseSize (opts) {
  try {
    // get the balance of the base account available to use
    let balance = Math.max(utility.subFloor8(utility.floor8(opts.product.baseAccount.balance), opts.product.baseAccount.config.minBalance), 0);
    log.debug('getUseSize ' + opts.product.baseAccount.currency + ' unheld balance: ' + balance + ', full ' + opts.product.baseAccount.currency + ' balance: ' + opts.product.baseAccount.balance);
    // get the quote currency balance
    let otherBalanceConverted = getQuoteCurrencyConvertedUsableBalance(opts);
    let combinedSize = addFloor8(balance, otherBalanceConverted);
    let higherBalance = Math.max(balance, otherBalanceConverted);
    let lowerBalance = Math.min(balance, otherBalanceConverted);
    let balanceToUse;
    if (opts.product.config.useHigherBalance) {
      balanceToUse = higherBalance;
    } else if (opts.product.config.useLowerBalance) {
      balanceToUse = lowerBalance;
    } else {
      balanceToUse = combinedSize;
    }
    return multFloor8(balanceToUse, opts.product.config.balancePercent || 0.01);
  } catch (err) {
    log.error(err.stack);
  }
};

/**
 *  Quote currency less min hold amount, converted to base currency
 */
function getQuoteCurrencyConvertedUsableBalance (opts) {
  let otherBalance = utility.floor8(opts.product.quoteAccount.balance);
  let minOtherBalance = opts.product.quoteAccount.config.minBalance;
  if (minOtherBalance) {
    otherBalance = Math.max(utility.subFloor8(otherBalance, minOtherBalance), 0);
  }
  // convert the other balance to base currency
  return divFloor8(otherBalance, opts.product.ticker.price);
}
