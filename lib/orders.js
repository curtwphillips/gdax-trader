const _ = require('lodash');
const config = require('./config');
const log = require('./log');
const math = require('mathjs');
const accounts = require('./accounts');
const products = require('./products');
const requests = require('./requests');
const utility = require('./utility');
const trader = require('./trader');
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

let orderFloatProperties = ['price', 'size', 'remaining_size', 'fill_fees', 'filled_size', 'executed_value'];

/*
{"id":"796fd579-ea5a-4967-b4ba-f8fa01252b1d","price":0.00832,"size":2.11432589,"product_id":"LTC-BTC","side":"sell","stp":"dc","type":"limit","time_in_force":"GTC","post_only":true,"created_at":"2017-12-06T06:36:25.547575Z","fill_fees":0,"filled_size":0,"executed_value":0,"status":"pending","settled":false}
*/
const responseOmit = ['product_id', 'stp', 'type', 'time_in_force', 'post_only', 'fill_fees', 'executed_value', 'settled'];

/*
{"id":"63d1541b-0c14-41b7-bf69-6cb648a46938","price":"0.00832000","size":"2.11432589","product_id":"LTC-BTC","side":"sell","stp":"dc","type":"limit","time_in_force":"GTC","post_only":true,"created_at":"2017-12-06T06:41:27.931033Z","fill_fees":"0.0000000000000000","filled_size":"0.00000000","executed_value":"0.0000000000000000","status":"pending","settled":false}
*/
const orderResultOmit = responseOmit;

/*
  "type": "done",
  "side": "buy",
  "order_id": "d31751f1-9ee5-4d1c-852a-b31e3fcc6349",
  "reason": "filled",
  "product_id": "LTC-BTC",
  "price": 0.00828,
  "remaining_size": 0,
  "sequence": 328308279,
  "user_id": "578b12fceb342e050a000267",
  "profile_id": "542cabb6-eacd-4d5d-a116-268df430fb2b",
  "time": "2017-12-06T07:24:41.835000Z"
}
*/
const doneOmit = ['type', 'product_id', 'sequence', 'user_id', 'profile_id', 'time'];

exports.init = async function () {
  try {
    if (config.gdax.cancelOnStartup) await exports.cancelAll();
  } catch (err) {
    log.error(err.stack);
  }
}

exports.create = async function (opts, side, retries) {
  try {
    let price = opts[side].incrementedPrice;
    let useSize = opts[side].useSize;
    let product = opts.product;
    let orders = product.orders;
    retries = retries || 0;
    let premsg = '[create] ' + opts.trackingNumber + ' ' + opts.product.id + ' ' + side + ' $' + price + ' retries: ' + retries + ' ';
    log.debug('*** ' + opts.trackingNumber + ' START CREATE ' + side.toUpperCase() + ' ORDER');
    opts[side].orderParams = { // BUY BUY BUY BUY BUY BUY BUY BUY
      price: price,
      size: useSize,
      product_id: product.id,
      post_only: true,
    };
    if (retries > 3) {
      return log.error(premsg + 'order failed on ' + retries + ' attempts, orderParams: '+ JSON.stringify(opts[side].orderParams));
    }
    let priceIsPending = isPricePending(opts, side, price);
    if (priceIsPending) {
      log.debug(premsg + 'priceIsPending: ' + priceIsPending + ', possible: ' + opts[side].possible);
      return;
    }
    if (!config.gdax.realOrders) {
      return log.info(premsg + '*** STOP *** b/c config.gdax.realOrders, orderParams: ' + JSON.stringify(opts[side].orderParams, null, 2));
    }

    if (opts[side].lastSentPrice === opts[side].orderParams.price) {
      log.debug(premsg + 'Stop b/c order price matches last sent price');
      return;
    }

    opts[side].lastSentPrice = opts[side].orderParams.price;
    log.debug('*** ' + opts.trackingNumber + ' SENDING ' + side.toUpperCase() + ' ' + premsg + 'params: ' + JSON.stringify(opts[side].orderParams));
    let orderResult = await requests.authed(side, [opts[side].orderParams]);
    log.debug('*** ' + opts.trackingNumber + ' ORDER RESULT ' + side.toUpperCase() + ' ' + premsg + JSON.stringify(_.omit(orderResult, orderResultOmit)));
    if (!orderResult) {
      opts[side].lastSentPrice = 0;
      return log.error(premsg + 'No order result received, orderParams: '+ JSON.stringify(opts[side].orderParams));
    }
    if (orderResult.message || !orderResult.status || orderResult.status === 'rejected') {
      opts[side].lastSentPrice = 0;
      if (orderResult.reject_reason === 'post only') {
        opts.onPriceOnce = true;
        let updatedPrice = side === 'buy' ? subRound8(price, opts.increment) : addRound8(price, opts.increment);
        opts[side].cancelEdgePrice = side === 'buy' ? subRound8(opts[side].cancelEdgePrice, opts.increment) : addRound8(opts[side].cancelEdgePrice, opts.increment);
        retries++;
        log.debug(premsg + '*** rejected post_only ***, RETRY best_bid: ' + opts.product.ticker.best_bid + ', best_ask: ' + opts.product.ticker.best_ask + ', orderParams: '+ JSON.stringify(opts[side].orderParams));
        // return await exports.create(opts, side, retries);
        return;
      }
      return log.error(premsg + 'Problem with order, message: ' + orderResult.message + ', order: ' + JSON.stringify(orderResult) + ', opts[side].orderParams: ' + JSON.stringify(opts[side].orderParams) + ', rangeSize: ' + opts.rangeSize + ', status: ' + orderResult.status + ', reject_reason: ' + orderResult.reject_reason + ', lastPrice: ' + opts.product.ticker.price + ', opts: '+ JSON.stringify(opts));
    }
    if (orderResult.status !== 'pending') { // unexpected, but still valid?
      log.error(premsg + 'Expected order to be pending, instead status = ' + orderResult.status + ', orderResult: ' + JSON.stringify(orderResult, null, 2) + ', opts: ' + JSON.stringify(opts, null, 2));
    }
    await exports.handleOrder(orderResult);
    // log.debug(premsg + 'submitted orderParams: ' + JSON.stringify(opts[side].orderParams));

  } catch (err) {
    log.error(err.stack);
  } finally {
log.debug('*** ' + opts.trackingNumber + ' FINALLY CREATE ' + side.toUpperCase() + ' ORDER');
  }
}

exports.handleOrder = function (data) { // send new order data here
  try {
    let productId = data.product_id;
    let product = products.products[productId];
    if (!product) return log.error(productId + ' [handleOrder] Trade data not found for data: ' + JSON.stringify(data, null, 2));
    let side = data.side;
    let orders = product.orders[side];
    let premsg = '[handleOrder] ' + product.id + ', side: ' + side + ' ';
    utility.parseFloatObject(data, orderFloatProperties);
    if (side !== 'buy' && side !== 'sell') return log.error(premsg + 'Unrecognized side');
    let id = getIdFromOrder(data); // data.id || data.order_id || data.maker_order_id;
    if (!id) return log.error('Could not get order id from order data: ' + JSON.stringify(data));
    let order = orders[id];
    let baseAccount = accounts.accounts[product.base_currency];
    let quoteAccount = accounts.accounts[product.quote_currency];
    if (!order) { // order is new
      if (data.type && data.type !== 'limit') { // orders with a type come from gdax
        return log.info(premsg + 'Order should exist for type: ' + data.type + ', data: ' + JSON.stringify(data) + ', orders: ' + JSON.stringify(orders));
      }
      orders[id] = {
        id: id,
        data: {},
        filled: false,
        price: data.price,
        remainingSize: data.size,
        side: data.side,
        size: data.size,
        status: data.status, // pending, canceled
        type: data.type, // open, done, limit
      }
      order = orders[id];
      if (data.settled) {
        log.error('New order is settled data: ' + JSON.stringify(data) + ', order: ' + JSON.stringify(orders[id]));
      }
      order = orders[id];
      order.data.response = data; // this is a create order response
      log.debug('data.response: ' + JSON.stringify(_.omit(order.data.response, responseOmit)));
      // lower available on the account that is decreasing
      let account = side === 'buy' ? quoteAccount : baseAccount;
      let changeSize = side === 'buy' ? multRound8(order.size, order.price) : order.size;
      account.available = subRound8(account.available, changeSize);
      return;
    } else if (data.type !== 'done') {
      log.debug(premsg + 'ignoring data type: ' + data.type + ', data: ' + JSON.stringify(order));
      return;
    }
    premsg += 'DONE ';
    // set data.response to data
    order.data[data.type] = data;
    order.status = 'done';
    log.debug('***  DONE ' + side.toUpperCase() + ' data: ' + premsg + JSON.stringify(_.omit(data, doneOmit), null, 2));
    if (data.reason === 'filled') {
      order.remainingSize = 0;
      order.filled = true;
      product[side].lastFillPrice = order.price;
      product[side].lastFillTime = new Date();
      log.debug(side + ' lastFillTime updated to ' + product[side].lastFillTime + ', lastFillPrice: ' + product[side].lastFillPrice);
      // ****** decrease balance of one increase balance and available of other
    } else if (data.reason === 'canceled') {
      order.remainingSize = data.remaining_size;
      order.isCanceled = true;
      // ****** add back to available, no balance change
    } else {
      log.error(product.currency + ' Unrecognized data type reason: ' + data.reason + ', data: ' + JSON.stringify(data, null, 2));
    }
    let baseChangeSize = subRound8(order.data.response.size, data.remaining_size);
    let baseUnchangeSize = subRound8(order.data.response.size, baseChangeSize);
    if (baseChangeSize < 0) return log.error(premsg + 'Size changed by less than zero');
    let quoteChangeSize = multRound8(baseChangeSize, order.price);
    if (quoteChangeSize < 0) return log.error(premsg + 'Quote currency size changed by less than zero');
    let quoteUnchangeSize = multRound8(baseUnchangeSize, order.price);
    if (order.filled && !baseChangeSize) {
      log.info('\n\n' + '*** expected base change ' + side.toUpperCase() + ' size *** \n\n' + premsg);
    }
    // a non canceled done order should have a changesize
    if (!order.isCanceled && (!baseChangeSize || isNaN(baseChangeSize))) {
      log.error(premsg + 'No quoteChangeSize after checking size and remaining_size, quoteChangeSize: ' + quoteChangeSize + ', isAllFilled: ' + isAllFilled + ', remainingSize: ' + remainingSize + ', isCanceled: ' + isCanceled + ', isPartial: ' + isPartial + ', noneFilled: ' + noneFilled + ', order: ' + JSON.stringify(order) + ', side: ' + side + ', order: ' + JSON.stringify(order));
      return;
    }
    if (!baseChangeSize) {
      // fully canceled order
      if (side === 'buy') {
        // add back to available quote currency
        quoteAccount.available = addFloor8(quoteAccount.available, quoteUnchangeSize);
      } else {
        // add back to available base currency
        baseAccount.available = addFloor8(baseAccount.available, baseUnchangeSize);
      }
    } else {
      if (side === 'buy') {
        // raise base_currency available and balance
        baseAccount.balance = addFloor8(baseAccount.balance, baseChangeSize);
        baseAccount.available = addFloor8(baseAccount.available, baseChangeSize);
        // lower quoted_currency balance (available was lowered on create)
        quoteAccount.balance = subFloor8(quoteAccount.balance, quoteChangeSize);
        product[side].lastFillPrice = order.price;
      } else { // side === sell
        // lower base_currency balance(available was lowered on create)
        baseAccount.balance = subFloor8(baseAccount.balance, baseChangeSize);
        // raise quoted_currency available and balance
        quoteAccount.balance = floor8(math.add(quoteAccount.balance, quoteChangeSize));
        quoteAccount.available = floor8(math.add(quoteAccount.available, baseChangeSize));
      }
      product[side].lastFillTime = new Date();
      product[side].lastFillPrice = order.price;
      log.debug(side + ' lastFillTime updated to ' + product[side].lastFillTime + ', lastFillPrice: ' + product[side].lastFillPrice);
      log.debug(premsg + 'lastFillPrice updated: ' + JSON.stringify(product.stats));
    }
    log.debug(premsg + 'baseAccount.balance: ' + baseAccount.balance + ', quoteAccount.balance: ' + quoteAccount.balance + ', baseAccount.available: ' + baseAccount.available + ', quoteAccount.available: ' + quoteAccount.available + ', baseChangeSize: '+ baseChangeSize + ', quoteChangeSize: ' + quoteChangeSize);
    removeOrder(product, order);
    product.onPriceOnce = true;
    trader.onPrice(product.id, product.ticker);
  } catch (err) {
    log.error(err.stack);
  }
}

function isPricePending (opts, side, price) {
  try {
    let product = opts.product;
    let isPending = false;
    // go through each pending order, if price is matched return true
    for (let id in product.orders[side]) {
      let order = product.orders[side][id];
      if (order.price === price) {
        isPending = true;
        break;
      }
    }
    return isPending;
  } catch (err) {
    log.error(err.stack);
  }
}

/*
{ // data - canceled
  "type": "done",
  "side": "sell",
  "order_id": "c8f9c802-7619-41cf-a38e-a1e64c1da2c5",
  "reason": "canceled",
  "product_id": "LTC-USD",
  "price": "60.05000000",
  "remaining_size": "0.20000000",
  "sequence": 691883603,
  "user_id": "578b12fceb342e050a000267",
  "profile_id": "542cabb6-eacd-4d5d-a116-268df430fb2b",
  "time": "2017-11-12T05:37:25.613000Z"
}
*/
async function removeIfExpiredOrder(product, side, order) {
  if (!order.pendingCancel || order.cancelAttempts < 3) return;
  let threshold = new Date(new Date().getTime() - 20000);
  if (order.pendingCancel < threshold) {
    // order pending cancel too long, cancel manually
    let orderData = {
      type: "done",
      side: side,
      order_id: order.id,
      reason: "canceled",
      product_id: product.id,
      price: order.price,
      remaining_size: getOrderSize(product, order),
      sequence: 0,
      // user_id: "578b12fceb342e050a000267",
      // profile_id: "542cabb6-eacd-4d5d-a116-268df430fb2b",
      time: new Date(),
    }
    await exports.handleOrder(orderData);
    return true;
  }
}

exports.cancelOutsideRange = async function (opts, side, edge) {
  try {
    let product = opts.product;
    let orders = product.orders;
    let possible = opts[side].possible;
    let premsg = '[cancelOutsideRange] ' + opts.trackingNumber + ' ' + product.id + ' ' + side + ' price: ' + product.ticker.price + ', edge: ' + edge + ', possible: ' + possible + ', best_bid: ' + opts.product.ticker.best_bid + ', best_ask: ' + opts.product.ticker.best_ask + ', ';
    // go through each pending order, if price is outside edge cancel it
    let wereCanceled = false;
    let remainingOrders = [];
    let otherSide = side === 'buy' ? 'sell' : 'buy';
    let edge2 = side === 'buy' ? opts.product.ticker.best_ask : opts.product.ticker.best_bid;
    for (let id in product.orders[side]) {
      let order = orders[side][id];
      let removed = await removeIfExpiredOrder(product, side, order);
      // log.debug(premsg + 'canceling id: ' + id + ' at price: ' + order.price + ', with ' + order.cancelAttempts + ' prior attempts, removed: ' + removed);
      if (removed) continue;

      if (order.pendingCancel || isPastEdge(side, edge, order.price) || isPastEdge(otherSide, edge2, order.price)) {
        log.debug(premsg + 'canceling id: ' + id + ' at price: ' + order.price + ', with ' + order.cancelAttempts + ' prior attempts');
        await cancelById(id);
        order.cancelAttempts = order.cancelAttempts || 0;
        order.cancelAttempts++;
        order.pendingCancel = new Date();
        wereCanceled = true;
      } else {
        // do not add a canceled order to pending orders
        if (order.pendingCancel) continue;
        let ordDate = new Date(order.data.response.created_at);
        let found = false;
        for (let i = 0; i < remainingOrders.length; i++) {
          if (order.price === remainingOrders[i].price) {
            found = true;
            let remDate = new Date(remainingOrders[i].data.response.created_at);
            if (ordDate > remDate) {
              // cancel older one
              log.debug(premsg + 'canceling id: ' + remainingOrders[i].id + ' at price: ' + remainingOrders[i].price);
              await cancelById(remainingOrders[i].id);
              remainingOrders[i].pendingCancel = true;
              wereCanceled = true;
            } else {
              log.debug(premsg + 'canceling id: ' + id + ' at price: ' + order.price);
              await cancelById(id);
              order.pendingCancel = new Date();
              wereCanceled = true;
            }
            break;
          }
        }
        if (!found) {
          remainingOrders.push(order);
        }
      }
    }
    // log.debug(premsg + 'remainingOrders.length: ' + remainingOrders.length);
    // check for the max number of orders to allow
    if (remainingOrders.length > possible) {
      let numToRemove = subRound8(remainingOrders.length, possible);
      if (numToRemove < 0) return log.error(premsg + 'numToRemove: '+ numToRemove + ' < 0');
      log.debug(premsg + 'numToRemove: '+ numToRemove);
      remainingOrders = _.sortBy(remainingOrders, 'price');
      log.debug(premsg + 'remainingOrders: ' + JSON.stringify(remainingOrders));
      if (side === 'buy') {
        // remove lowest orders if none out of range
        for (let i = 0; i < numToRemove; i++) {
          let id = remainingOrders[i].id;
          await cancelById(id);
          log.debug(premsg + 'cancel ' + id);
          wereCanceled = true;
        }
      } else {
        // remove highest orders
        for (let i = 0; i < numToRemove; i++) {
          let id = remainingOrders[remainingOrders.length - i - 1].id;
          await cancelById(id);
          log.debug(premsg + 'cancel ' + id);
          wereCanceled = true;
        }
      }
    }
    return wereCanceled;
  } catch (err) {
    log.error(err.stack);
  }
}

function isPastEdge (side, edge, price) {
  try {
    if (side === 'buy') {
      if (price < edge) return true;
    } else if (side === 'sell') {
      if (price > edge) return true;
    } else {
      log.error('Unrecognized side: ' + side + ' with edge: ' + edge);
    }
  } catch (err) {
    log.error(err.stack);
  }
}

/**
 * return true for ready for new order, false for not ready. if not cancelAllSide then only cancel orders within range of current order
 */
async function cancelById (id) {
  try {
    let result = await requests.authed('cancelOrder', [id]);
  } catch (err) {
    log.error(err.stack);
  }
}

/**
 * return true for ready for new order, false for not ready. if not cancelAllSide then only cancel orders within range of current order
 */
exports.cancelPendingOrders = async function (opts, side, cancelAllSide) {
  try {
    let product = opts.product;
    let orders = product.orders[side];
    if (cancelAllSide) {
      for (let id in orders) {
        await requests.authed('cancelOrder', [id]);
      }
      return true;
    }
    let orderParams = opts[side].orderParams;
    let premsg = '[cancelPendingOrders] ' + product.currency + ' orderParams: ' + JSON.stringify(orderParams) + ', side: ' + side + ' ';
    let success = true;
    if (!orders) {
      log.error(premsg + 'found nothing for side: ' + side);
      return false;
    }
    for (var orderId in orders) {
      let order = orders[orderId];
      if (order.status === 'done') continue;
      // find the range of the order, if it is out of range, cancel it
      // get the price of the order
      if (side === 'buy') {
        if (orderRangeSection < coinSection) {
          await requests.authed('cancelOrder', [orderId]);
        } else if (orderRangeSection !== coinSection) {
          success = false; // the order is closer to the price than this new order would be, don't cancel
        } else {
          success = false; // there is already an order for this range
        }
      } else if (side === 'sell') {
        if (orderRangeSection > coinSection) {
          await requests.authed('cancelOrder', [orderId]);
        } else if (orderRangeSection !== coinSection) { 
          success = false; // the order is closer to the price than this new order would be, don't cancel
        } else {
          success = false; // there is already an order for this range
        }
      } else {
        return log.error(premsg + 'side: ' + side + ', not a valid side');
      }
    }
    return success;
  } catch (err) {
    log.error(err.stack);
  }
}

exports.cancelAll = async function () {
  
  for (let id in config.products) {
    log.debug('cancelAll id: ' + id);
    await requests.authed('cancelAllOrders', [{product_id: id}]);
    
  }

}

function getIdFromOrder (ord) {
  
  try {
    if (!ord) return log.error('no order: ' + JSON.stringify(ord));
    let ordId = ord.orderId || ord.order_id || ord.id;
    if (ordId) return ordId;
    let data = ord.data || ord;
    let type = data.response || data.done || data.filled;
    if (!type) {
      log.error('[getIdFromOrder] id not found for order: ' + JSON.stringify(ord));
    }
    
    return type.id || type.order_id || type.maker_order_id;
  } catch (err) {
    log.error(err.stack);
  }
}

function getOrderSize (product, ord) {
  try {
    if (!ord) return log.error('no order: ' + JSON.stringify(ord));
    let orderSize = ord.size || ord.remainingSize || ord.remaining_size || ord.data.size || ord.data.response.size;
    if (!orderSize) {
      log.error('[getOrderSize] size not found for order: ' + JSON.stringify(ord));
    } else {
      log.debug('[getOrderSize] orderSize: ' + orderSize);
    }
    
    return orderSize;
  } catch (err) {
    log.error(err.stack);
  }
}

function removeOrder (product, order) {
  try {
    let side = order.side
    if (!order) return;
    let found = false;
    let deleteOrderId = getIdFromOrder(order);
    let sizeRemoved = 0;
    for (let orderId in product.orders[side]) {
      if (orderId === deleteOrderId) {
        let order = product.orders[side][orderId];
        sizeRemoved = order.size;
        delete product.orders[side][orderId];
        product.removedOrder = orderId;
        found = true;
        break;
      }
    }
    if (!found) {
      log.error(product.id + ' Could not find order to delete after sell, side: ' + side + ', order: ' + JSON.stringify(order) + ', product.orders[side]: ' + JSON.stringify(product.orders[side]));
    }
    return sizeRemoved;
  } catch (err) {
    log.error(err.stack);
  }
}

function checkAwaits () { // don't let a missing response for an order keep awaiting
  try {
    let now = new Date();
    let sides = ['buy', 'sell'];
    for (let id in config.products) {
      let product = accounts.products[id];
      for (let j = 0; j < sides.length; j++) {
        let side = sides[j];
        if (product.awaiting[side]) {
          let msPast = utility.getMsBetween(product.awaiting[side], now);
          if (msPast < 20000) {
            product.awaiting[side] = false;
            log.info(product.currency + ' checkAwaits removed await for ' + side);
          }
        }
      }
    }
    setTimeout(checkAwaits, 5000);
  } catch (err) {
    log.error(err.stack);
  }
}
