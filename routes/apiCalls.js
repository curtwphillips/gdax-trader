// let _ = require('lodash');
// let apiCalls = require('../lib/apiCalls');
// let errors = require('../lib/errors');
// let auth = require('../lib/auth');
// let log = require('../lib/log');

// async function getParams (ctx, next) {
//   try {
//     auth.getUserName(ctx);
//     let opts = _.omit(ctx.request.query, ['user_id', 'authToken']);
//     let results = await apiCalls.getApiCall(opts);
//     if (results.error && !results.portalMetaData) {
//       return errors.handleError(ctx, results.error, null, null, __line);
//     }
//     ctx.body = results;
//   }catch (err) {
//     log.error(err);
//     return errors.handleError(ctx, err, null, null, __line);
//   }
// }

// async function postParams (ctx, next) {
//   try {
//     auth.getUserName(ctx);
//     let opts = _.omit(ctx.request.body, ['user_id', 'authToken']);
//     ctx.body = await apiCalls.getApiCall(opts);
//   }catch (err) {
//     return errors.handleError(ctx, err, null, null, __line);
//   }
// }

// exports.routes = [
//   { route: '/getParams',  type: 'get',  handler: getParams  },
//   { route: '/postParams', type: 'post', handler: postParams },
// ];
