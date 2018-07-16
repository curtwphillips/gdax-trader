/* NOT IN USE
 * Get past orders that are still held so we know our balances at each price point
 */
async function setLastOrderPrices (lastTradeId) { // recursive calls use lastTradeId
  try {
    if (!config.gdax.getPriorOrders) return log.info('[setLastOrderPrices] Skipping fetching prior orders');
    let premsg = '[setLastOrderPrices] lastTradeId: ' + lastTradeId + ', ';
    let params = lastTradeId ? [{'after': lastTradeId}] : [];
    let getFills = await requests.authed('getFills', params); // 100 at a time, get new update with 'before', old with 'after'
    if (!getFills || !getFills.length) {
      if (priorLastTradeId === lastTradeId) {
        log.info(premsg + 'ran out of filled orders');
        for (let id in config.products) {
          let prod = exports.products[id];
          log.debug(premsg + 'id: ' + id + ', product.stats: ' + JSON.stringify(prod.stats));
        }
        return;
      }
      priorLastTradeId = lastTradeId;
      return await setLastOrderPrices (lastTradeId);
    }
    priorLastTradeId = lastTradeId;
    let allComplete = false;
    for (let i = 0; i < getFills.length; i++) {
      fillsCount++;
      let fill = getFills[i];
      // if (fill.side !== 'buy') continue;
      fill.size = math.round(Number.parseFloat(fill.size), 8);
      let productId = fill.product_id;
      if (unusedProducts[productId]) continue; // unused product id
      let product = exports.products[productId];
      if (!product) {
        log.debug(premsg + 'skipping ' + productId + ', not found');
        unusedProducts[productId] = true;
        continue;
      }
      if (productId === 'LTC-BTC') {
        // log.debug(premsg + 'fill: ' + JSON.stringify(fill) + ', product.stats: ' + JSON.stringify(product.stats));
        log.debug(premsg + 'config.products[productId].compareLastFill: '+ config.products[productId].compareLastFill + ', product.stats.buy.lastFillPrice: ' + product.stats.buy.lastFillPrice + ', product.stats.sell.lastFillPrice: ' + product.stats.sell.lastFillPrice);
      }
      // continue if already complete for this product
      if (!config.products[productId].compareLastFill || (product.stats.buy.lastFillPrice && product.stats.sell.lastFillPrice)) continue;
      if (productId === 'LTC-BTC') {
        // log.debug(premsg + 'here');
      }
      // fill in missing pieces
      product.stats[fill.side].lastFillPrice = product.stats[fill.side].lastFillPrice || fill.price;
      product.stats[fill.side].lastFillTime = product.stats[fill.side].lastFillTime || new Date(fill.created_at);
      log.debug(premsg + 'filled in product.stats[fill.side].lastFillPrice: ' + product.stats[fill.side].lastFillPrice + ', product.stats[fill.side].lastFillTime: ' + product.stats[fill.side].lastFillTime);
      // check if all products are ready
      let areMissing = false;
      for (let id in config.products) {
        let prod = exports.products[id];
        if (config.products[productId].compareLastFill && (!product.stats.buy.lastFillPrice || !product.stats.sell.lastFillPrice)) {
          areMissing = true;
          break;
        }
      }
      if (!areMissing) {
        allComplete = true;
        break;
      }
    }
    if (allComplete) {
      for (let id in config.products) {
        let prod = exports.products[id];
        log.debug(premsg + 'id: ' + id + ', product.stats: ' + JSON.stringify(prod.stats));
      }
      log.debug(premsg + 'fillsCount: ' + fillsCount + ', lastTradeId: ' + lastTradeId);
      return true;
    } else {
      let lastTradeId = getFills[getFills.length - 1].trade_id;
      return await setLastOrderPrices(lastTradeId);
    }
  } catch (err) {
    log.error(err.stack);
  }
}
