// var _ = require('lodash');
// var apiCalls = require('../lib/apiCalls');
// var errors = require('../lib/errors');
// var auth = require('../lib/auth');
// var log = require('../lib/log');

// async function getParams (ctx, next) {
//   try {
//     auth.getUserName(ctx);
//     var opts = _.omit(ctx.request.query, ['user_id', 'authToken']);
//     var results = await apiCalls.getApiCall(opts);
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
//     var opts = _.omit(ctx.request.body, ['user_id', 'authToken']);
//     ctx.body = await apiCalls.getApiCall(opts);
//   }catch (err) {
//     return errors.handleError(ctx, err, null, null, __line);
//   }
// }

// exports.routes = [
//   { route: '/getParams',  type: 'get',  handler: getParams  },
//   { route: '/postParams', type: 'post', handler: postParams },
// ];
