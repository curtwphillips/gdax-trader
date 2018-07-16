    // Starting buy amount
    let m = math.round(math.multiply(product[side].coinPrice, product[side].coinQty), 2);
    // Increasing ratio
    let r = product.productConfig.increasingBuyRatio;
    // Total to spend
    let M = math.multiply(math.divide(accounts.getBalanceUSD(), 2), product.productConfig.spikeDropSpendPercent || 1); // divide by number of currencies in use
    M = math.round(math.multiply(M, .98), 2); // shave off 2% to make it simpler to avoid insufficient funds
    // determine the number of points to use N
    /*
      N = (log(1-M/m(1-r)))/logr
    */
    let N = (Math.log10(1 - M/m * (1-r))) / Math.log10(r);
    N = Math.floor(N); // round points to use down, 13.4566 becomes 13

    let spikeDropPercent = product.productConfig.spikeDropPercent;



      let spikeDropPrice = math.round(math.multiply(product.price, math.subtract(1, spikeDropPercent)), 2);
      let dropRange = math.round(math.subtract(currentPrice, spikeDropPrice), 2);
      let dropRangePerSection = math.round(math.divide(dropRange, N), 2);
      for (let i = 0; i < N; i++) {
        if (i > 0) {
          buyCost = math.round(math.multiply(buyCost, r), 2); // prior cost * increasing rate = new cost
          coinQty = math.round(math.divide(buyCost, buyPrice), 8); // cost / price = qty
        }
      }
