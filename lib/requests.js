/*
These changes must be made in the gdax npm node module
located at - node_modules/gdax/lib/clients/websocket.js
var WebsocketClient = function(productIDs, websocketURI, auth, channel) { // added channel parameter line 13
AND
self.channel = channel; // added channel setting line 16
AND
if (self.channel) { // added channel logic line 65
  subscribeMessage.channels = [{ "name": self.channel, "product_ids": self.productIDs }]
} else {
  self.product_ids = self.productIDs;
}
AND
var sig = signRequest(self.auth, 'GET', '/users/self/verify'); // changed url for auth line 73
*/

const config = require('./config');
const log = require('./log');
const orders = require('./orders');
const trader = require('./trader');
const Gdax = require('gdax');
const utility = require('./utility');

const tickerFloatProperties = ['price', 'best_ask', 'best_bid', 'ask', 'bid'];

let publicClients = {};
  // 'BTC-USD': new Gdax.PublicClient('BTC-USD'),
  // 'ETH-USD': new Gdax.PublicClient('ETH-USD'),
  // 'LTC-USD': new Gdax.PublicClient('LTC-USD'),
  // 'LTC-BTC': new Gdax.PublicClient('LTC-BTC'),

for (let id in config.products) {
  publicClients[id] = new Gdax.PublicClient(id);
}

const key = config.gdax.key;
const b64secret = config.gdax.b64secret;
const passphrase = config.gdax.passphrase;

const apiURI = config.gdax.apiURI
const sandboxURI = config.gdax.sandboxURI;

let initialized = false;

var authedClient
if (config.server.useSandbox) {
  authedClient = new Gdax.AuthenticatedClient(key, b64secret, passphrase, sandboxURI);
} else {
  authedClient = new Gdax.AuthenticatedClient(key, b64secret, passphrase, apiURI);
}
const authObj = {
  secret: b64secret,
  key: key,
  passphrase: passphrase,
};

let product_ids, websocketTicker, websocketUser, tickerOpen, userOpen;

// open web socket communication
exports.init = function () {
  product_ids = [];
  for (let productId in config.products) {
    product_ids.push(productId);
  }
  log.debug('Requests will use product ids: ' + JSON.stringify(product_ids));
  startTicker();
  startUser();
  log.info('Requests initialized');
  initialized = true;
}

function startTicker () {
  if (tickerOpen) return;
  
  // send price updates to the trader
  log.debug('initializing websocketTicker for productIds: ' + JSON.stringify(product_ids));
  websocketTicker = new Gdax.WebsocketClient(product_ids, null, null, 'ticker');
  websocketTicker.on('message', data => {
    if (config.server.shuttingDown) return;
    if (data.type !== 'ticker' && data.type !== 'subscriptions') return log.error('websocket ticker received non-ticker data: ' + JSON.stringify(data));
    let productId = data.product_id;
    if (!productId) {
      if (data.type !== 'subscriptions' || !data.channels) {
        log.debug('websocket ticker data: ' + JSON.stringify(data));
      } else {
        return;
      }
    }
    utility.parseFloatObject(data, tickerFloatProperties);
    data.best_ask = data.best_ask || data.ask;
    data.best_bid = data.best_bid || data.bid;
    trader.onPrice(productId, data);
  });
  websocketTicker.on('error', err => {
    log.error('websocket ticker error: ' + JSON.stringify(err));
  });
  websocketTicker.on('close', () => {
    log.info('websocket ticker closed');
    tickerOpen = false;
  });
  tickerOpen = true;
}

let ignoreUserDataTypes = ['open', 'received', 'match'];

function startUser () {
  if (userOpen) return;
  
  // send order updates to the trader
  log.debug('initializing websocketUser for productIds: ' + JSON.stringify(product_ids));
  websocketUser = new Gdax.WebsocketClient(product_ids, null, authObj, 'user');
  websocketUser.on('message', data => {
    if (config.server.shuttingDown) return;
    if (data.type === 'subscriptions') {
      // log.debug('[onUserData] subscriptions: ' + JSON.stringify(data));
    } else {
      if (ignoreUserDataTypes.indexOf(data.type) !== -1) return;
      orders.handleOrder(data);
    }
  });
  websocketUser.on('error', err => {
    log.error('websocket user error: ' + JSON.stringify(err));
  });
  websocketUser.on('close', () => {
    log.info('websocket user closed');
    userOpen = false;
  });
  userOpen = true;
}

// access private api methods
exports.authed = async function (fn, params) {
  try {
    params = params || [];
    if (!Array.isArray(params)) params = [params];
    return new Promise(function (resolve, reject) {
      params.push(function (err, response, data) {
        if (err) {
          log.error(err);
          // error: [requests.js:108] Error: getaddrinfo ENOTFOUND api.gdax.com api.gdax.com:443
          return reject(err);
        } else {
          return resolve(data);
        }
      });
      authedClient[fn].apply(authedClient, params);
    });
  } catch(err) {
    log.error(err.stack || err);
  }
}

// access public api methods
exports.public = async function (fn, prodId, params) {
  try {
    
    params = params || [];
    return new Promise(function (resolve, reject) {
      
      params.push(function (err, response, data) {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
      if (!publicClients[prodId]) {
        publicClients[prodId] = new Gdax.PublicClient(prodId);
        // return reject('prodId: ' + prodId + ' is not a valid public client');
      }
      
      publicClients[prodId][fn].apply(publicClients[prodId], params);
    });
  } catch(err) {
    log.error(err.stack || err);
  }
}

exports.checkConnectionsDelayed = function () {
  setTimeout(function () {
    
    if (initialized) {
      startTicker();
      startUser();
    }
    exports.checkConnectionsDelayed();
  }, 15000);
};

exports.checkConnectionsDelayed();
