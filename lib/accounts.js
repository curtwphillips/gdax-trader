const _ = require('lodash');
const math = require('mathjs');
const cache_files = require('./cache_files');
const config = require('./config');
const log = require('./log');
const orders = require('./orders');
const requests = require('./requests');
const stats = require('./stats');
const trader = require('./trader');
const utility = require('./utility');
const accountFloatProperties = ['balance', 'available', 'hold'];

exports.accounts = {};

exports.init = async function () {
  let accounts = await requests.authed('getAccounts'); // get account balances
  if (!accounts || !accounts.length) {
    let retry = 2000;
    log.info('Accounts not found. Retrying in ' + retry + ' seconds');
    await utility.sleep(retry);
    return await exports.getAccounts();
  }
  for (let i = 0; i < accounts.length; i++) {
    let account = accounts[i];
    utility.parseFloatObject(account, accountFloatProperties);
    exports.accounts[account.currency] = account;
    exports.accounts[account.currency].config = config.accounts[account.currency];
  }
};

exports.checkBalances = async function () {
  log.debug('CHECKING BALANCES');
  let accounts = await requests.authed('getAccounts'); // get account balances
  if (!accounts || !accounts.length) {
    let retry = 2000;
    log.info('Accounts not found. Retrying in ' + retry + ' seconds');
    await utility.sleep(retry);
    return await exports.checkBalances();
  }
  for (let i = 0; i < accounts.length; i++) {
    let account = accounts[i];
    utility.parseFloatObject(account, accountFloatProperties);
    if (utility.floor8(exports.accounts[account.currency].balance) !== utility.floor8(account.balance)) {
      if (account.balance - exports.accounts[account.currency].balance > 1) {
        log.error(account.currency + ' is off by over 1\n' + JSON.stringify(account));
      } else {
        log.debug(account.currency + ' balance from gdax ' + exports.accounts[account.currency].balance + ' did not equal calculated balance ' + utility.floor8(account.balance));
      }
      exports.accounts[account.currency].balance = account.balance;
    }
    if (utility.floor8(exports.accounts[account.currency].available) !== utility.floor8(account.available)) {
      if (account.available - exports.accounts[account.currency].available > 10) {
        log.error(account.currency + ' available from gdax ' + exports.accounts[account.currency].available + ' did not equal calculated available ' + utility.floor8(account.available));
        exports.accounts[account.currency].available = utility.floor8(account.available);
      } else {
        log.debug(account.currency + ' available from gdax ' + exports.accounts[account.currency].available + ' did not equal calculated available ' + utility.floor8(account.available));
      }
    }
  }
};

utility.runEveryMsAsync(60000, async function () {
  await exports.checkBalances();
});
