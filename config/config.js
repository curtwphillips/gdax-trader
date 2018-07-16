/**
 * Local development configuration file.
 */
exports.server = {
  apiPort: 3344, // send api_listener requests to this port
  env: 'local',
  logLevel: 'debug', // debug or info, show log.debug and log.info messages
  logTimes: false, // logs a timestamp along with each log message
  port: 3345, // port the web server listens on, go to localhost:3345 in a browser
  testing: false, // use fake gdax responses and ticker
  useSandbox: false, // NOT IN USE requires a different api key?
};

exports.gdax = {
  delayPrice: 10000, // stall price checking, number of ms to wait between each price update
  realOrders: true, // turn off and on making real orders, off is good for pre-testing changes
  apiURI: 'https://api.gdax.com',
  cancelOnStartup: true, // cancel any open orders in gdax when the program starts up (includes every gdax open order, even manually entered orders)
  cancelOnShutdown: true, // cancel any open orders in gdax when the program shuts down (includes every gdax open order, even manually entered orders)
  getPriorOrders: false, // fetch prior buys and sells on start up to determine last completed prices
  key: '',
  b64secret: '',
  passphrase: '',
  sandboxURI: 'https://api-public.sandbox.gdax.com',
};

exports.accounts = {
  USD: {
    minBalance: 0, // keep at least this much of this currency available
    originalBalance: 0, // the final balance of this currency in gdax before starting the program
  },
  BTC: {
    originalBalance: 0,
    minBalance: 0,
    originalPrice: 11445.38, // the approximate price of the coin in gdax before starting the program
  },
  ETH: {
    originalBalance: 0,
    minBalance: 0,
    originalPrice: 0,
  },
  LTC: {
    originalBalance: 10.45349361,
    minBalance: 0,
    originalPrice: 99.80,
  }
};

exports.products = {
  'LTC-BTC': {
    boost: true, // if low on one currency, increase trade size to buy up to the low percent held value
    // for instance, if you have .01 LTC and 5 BTC and boost at the low percent puts the low ltc size at 1 ltc, buy 1 - .01 = .99 ltc
    lowHeldPercent: 0.05, // boost trades if coin is under this percent of combined coin value, combined coin value is ltc value plus btc value
    increment: .0001, // 0.00001,
    maxOrders: 1,
    // set useHigherBalance and useLowerBalance both to false if you want all orders to be the same size regardless of balances
    useHigherBalance: false, // if both this and useLowerBalance are true, this overrides useLowerBalance and higher balance is used
    /*
    instead of basing trade size on combined balance, base it on the balance that is higher
      example using value percent .05 and ltc balance is 30 and btc balance is 1 and rate is .008,
      if set to false, combined balance = 155, that is 30 ltc + 125 converted ltc from btc (1 btc / .008 rate). Use size is 155 ltc * .05 value percent which = 7.55 ltc per order
      if set to true, higher of 30 ltc and 1 btc converted to ltc (125 ltc) will be used. Use 125 ltc * .05 value percent which = 6.25 ltc per order
      when true, the highest possible use size = combined balance * value percent. for this example 155 * .05 = 7.55 per order
      when true, the lowest possible use size = combined balance / 2 * value percent. for this example 155 / 2 * .05 = 3.875 per order
      when true, the amount used increases as more of one coin is accumulated and shrinks as the ratio of coins held evens out
    example summary:
      highest: 7.55, when one coin balance is far higher than the other (like if you own 250 ltc and .004 btc which is worth .5 ltc)
      lowest: 3.875, when ltc and btc balances are worth the same (like if you own 125 ltc and 1 btc which is worth 125 ltc)
    when to pick this
      pick this if you want to do small trades when price is mostly stable and big trades as price gets farther in one direction, such as
      when price keeps dropping or keeps raising for a long time
    */
    useLowerBalance: true, // if both this and useHigherBalance are true, this overrides useLowerBalance and higher balance is used
    /*
    instead of basing trade size on combined balance, base it on the balance that is lower
      example using value percent .05 and ltc balance is 30 and btc balance is 1 and rate is .008,
      if set to false, combined balance = 155, that is 30 ltc + 125 converted ltc from btc (1 btc / .008 rate). Use size is 155 ltc * .05 value percent which = 7.55 ltc per order
      if set to true, smaller of 30 ltc and 1 btc converted to ltc (125 ltc) will be used. Use 30 ltc * .05 value percent which = 1.5 ltc per order
      when true, the highest possible use size = combined balance / 2 * value percent. for this example 155 / 2 * .05 = 3.875
      when true, the lowest possible use size = the minimum allowed based on minSize and the product minimum, usually .01
      when true, the amount used increases as the ratio of coins held evens out and shrinks as more of one coin is accumulated
    example summary:
      highest: 3.875, when ltc and btc balances are worth the same (like if you own 125 ltc and 1 btc which is worth 125 ltc)
      lowest: .01, when one balance is close to 0 (like if you own 250 ltc and .004 btc which is worth .5 ltc)
    when to pick this
      pick this if you want to do big trades when price is mostly stable and small trades as price gets farther in one direction, such as
      when price keeps dropping or keeps raising for a long time
    */
    balancePercent: 0.08, // percent of balance to use per order
    // The rates and percents below are used to make a scale factor for how much btc to hold, holding more as the rate gets higher
    lowRate: .006, // hold low percent of bitcoin when rate gets this low
    highRate: .02, // hold high percent of bitcoin when rate gets this high
    lowPercent: .1, // hold this percent in bitcoin when low rate is met
    highPercent: .9, // hold this percent in bitcoin when high rate is met
    buy: {
      // maxPrice: .012,
      maxSize: 8,
      minSize: .01,
      on: true,
    },
    sell: {// use higher buys to make selling easier when low on BTC
      // minPrice: 0.008,
      maxSize: 8,
      minSize: .01,
      on: true,
    }
  },
};
