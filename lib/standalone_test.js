/*
 * Test file to generate fake data and run through ideas
 * Does not do any live trading or any contacting gdax
 * Run with 'node tests.js' from the /lib directory
 */
const _ = require('lodash');
const log = require('./log');
const logarithms = require('./logarithms');
const utility = require('./utility');

// setup test data
let startUSD = 18000;
let usd = startUSD;
let dataPointsCount = 5000;
let minPrice = 35;
let maxPrice = 100;
let startPrice = 65;
let maxPriceJump = 1;
let sign = 1; // -1 or 1
let priceJump = 0;
let prices = [startPrice];
let rangeLength = .001;
let rangeSize = startPrice * rangeLength; // how big each range is
let minBuy = .001;
let minBuyCoin = .05;
let gainPricePercent = .1;
let lastBuy = 0;
let highestPrice = 0;
let lowestPrice;
let lowestUSD = startUSD;
let leanUp = true;
let changeSignCount = 0;
let bought = 0;
let sold = 0;
let sumPrice = 0;
let avgPrice = 0;
let avgBuyPrice = 0;
let downCount = 0;

function init () {
  try {
    log.debug('THIS IS ONLY A TEST');
    console.log('rangeSize: ' + rangeSize);
    for (let i = 0; i < dataPointsCount; i++) {
      let rand = Math.round(Math.random()); // 0 or 1
      if (rand) {
        sign = 1;
      } else {
        sign = -1;
      }
      if (sign == -1 && leanUp) {
        if (i % 50 == 0) {
          changeSignCount++;
          sign = 1;
        }
      }
      if (downCount && sign != -1) {
        sign = -1;
        downCount--;
      }
      priceJump = getRandomBetween(0, maxPriceJump);
      let price = Math.round((prices[prices.length - 1] + (priceJump * sign)) * 100) / 100;
      if (price < minPrice) {
        price = minPrice;
      }
      if (price > maxPrice) {
        downCount = 30;
      }
      prices.push(price);
    }

    console.log('changedSign: ' + changeSignCount + ', prices[0]: ' + prices[0] + ', last price: ' + prices[prices.length - 1]);
    console.log('price,value,holdvalue');

    function getRandomBetween(low, high) {
      return Math.random() * high + low;
    }

    let heldAmounts = {};
    let held = 0;

    // find results of buy and hold
    let holdOnlyQty = startUSD / prices[0];
    let holdOnlyFinalValue = holdOnlyQty * prices[prices.length - 1];

    let filledSectionsOrdered = [];

    let choice = '';
    let exchangedQty = 0;
    // find results of using strategy
    for (let i = 0; i < prices.length; i++) {
      let price = prices[i];
      sumPrice += price;
      avgPrice = sumPrice / (i + 1);
      if (!lowestPrice || price < lowestPrice) {
        lowestPrice = price;
      }
      if (price > highestPrice) {
        highestPrice = price;
      }
      // determine range section
      let rangeSection = Math.floor(price / rangeSize);
      let exchangedSection;
      let coinQty;
      let coinValue;
      let lastChoice = choice;
      choice = 'x';

      let isPriceLow = price < avgBuyPrice;
      let isGoodBuy = !heldAmounts[rangeSection] && price < avgPrice;
      let lowHeld = held * price < .1 * usd;
      let isEnoughUSD = usd > 100;
      if (isEnoughUSD && (lowHeld || isGoodBuy || isPriceLow)) { // buy
        let toBuy;
        if (!lastBuy || price > lastBuy) {
          toBuy = minBuy;
        } else {
          let buyDiffPercent = (lastBuy - price) / price;
          toBuy = logarithms.logslider(buyDiffPercent) / 100;
        }
        coinQty = Math.max(minBuyCoin, utility.round((toBuy * usd) / price, 2));
        coinValue = utility.round(coinQty * price, 2);
        exchangedSection = rangeSection;
        if (heldAmounts[rangeSection]) {
          heldAmounts[rangeSection].price += price;
          heldAmounts[rangeSection].spent += coinValue;
          heldAmounts[rangeSection].coinQty += coinQty;
        } else {
          heldAmounts[rangeSection] = {
            price: price,
            spent: coinValue,
            coinQty: coinQty,
          };
          filledSectionsOrdered.push(rangeSection);
          filledSectionsOrdered.sort(sortNumber);
        }
        choice = 'buy';
        bought += coinValue;
        lastBuy = price;
        usd -= coinValue;
        if (usd < lowestUSD) lowestUSD = usd;
        held += coinQty;
        avgBuyPrice = getAvgPrice();
      } else { // sell
        // compare this section to 1st held section
        let sectionsToGain = (gainPricePercent * price) / rangeSize;
        if (rangeSection >= filledSectionsOrdered[0] + sectionsToGain) {
          exchangedSection = filledSectionsOrdered[0];
          let pastHeld = heldAmounts[filledSectionsOrdered[0]];
          coinQty = pastHeld.coinQty;
          coinValue = utility.round(pastHeld.coinQty * price, 2);
          held = math.subtract(held, coinQty);
          usd += coinValue;
          sold += coinValue;
          choice = 'sell';
          delete heldAmounts[filledSectionsOrdered[0]];
          filledSectionsOrdered = filledSectionsOrdered.slice(1);
        }
      }
      let currentValue = held * price + usd;
      if (true || choice === 'x') {
        console.log(price + ',' + utility.round(currentValue, 2) + ',' + utility.round(holdOnlyQty * price, 2) + ',' + utility.round(held, 2) + ',' + choice + ',' + utility.round(usd, 2) + ',' + utility.round(held, 2) + ',' + coinQty + ',' + utility.round(avgPrice, 2) +','+ utility.round(avgBuyPrice, 2) + ',' + lowHeld + ',' + isGoodBuy + ',' +isPriceLow);
      } else {
        console.log(price + ',' + choice + ',' + coinQty + ',' + coinValue);
      }
    }
    console.log('lowestUSD: ' + lowestUSD + ', highestPrice: ' + highestPrice + ', lowestPrice: ' + lowestPrice);
    console.log('ENDING held: ' + Math.round(held) + ', usd: ' + Math.round(usd));
    let finalValue = held * prices[prices.length - 1] + usd;
    console.log('holdOnly: ' + Math.round(holdOnlyFinalValue) + ', strategy: ' + Math.round(finalValue));
    let winner = 'HOLDING';
    if (finalValue > holdOnlyFinalValue) {
      winner = 'STRATEGY';
    }
    console.log('winner: ' + winner + ', diff: ' + Math.round(finalValue - holdOnlyFinalValue));
    console.log('bought: ' + Math.round(bought) + ', sold: ' + Math.round(sold));
  } catch (err) {
    log.error(err.stack);
  }
}
function sortNumber(a,b) {
  return a - b;
}

function getAvgPrice () {
  let spent = 0;
  let coinQty = 0;
  for (var k in heldAmounts) {
    let h = heldAmounts[k];
    spent += h.spent;
    coinQty += h.coinQty;
  }
  avgBuyPrice = utility.round(spent / held, 2);
  return avgBuyPrice;
}
/*
heldAmounts[rangeSection] = {
  price: price,
  spent: toBuy * usd,
  coinQty: (toBuy * usd) / price,
};
*/
