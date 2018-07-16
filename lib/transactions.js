const _ = require('lodash');
const config = require('./config');
const log = require('./log');
const math = require('mathjs');
const requests = require('./requests');
const utility = require('./utility');
const queue_requests = require('./queue_requests');
const rest = require('./rest');

exports.init = async function () {
  let txs = require('../txs.js').txs;
  log.debug('Got txs length: ' + txs.length);
  if (!txs.length) {
    log.debug('txs: ' + JSON.stringify(txs));
  }
  for (let i = 0; i < txs.length; i++) {
    let tx = txs[i];
    if (tx.currency === 'ltc' || tx.id < 34240) {
      continue;
    }
    let txResult = await rest.getTransaction(tx.currency, tx.txid);
    if (!txResult) {
      log.error('No tx result for tx: ' + JSON.stringify(tx));
    } else if (!txResult.block_height || txResult.block_height < 400000) {
      log.debug('no block_height for tx: ' + JSON.stringify(tx));
    } else {
      if (tx.id % 10 === 0) {
        log.debug(tx.id + ',' + tx.txid + ',' + txResult.block_height);
      }
    }
  }
}
