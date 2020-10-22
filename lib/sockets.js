const config = require("./config");
const log = require("./log");
const info = require("./info");
const stats = require("./stats");

let io;
let usersOnline;
exports.init = function (io_connection) {
  io = io_connection;
  io.on("connection", function (socket) {
    let user;
    socket.on("connected", function (userObject) {});
    socket.on("disconnect", function () {
      log.debug("disconnect");
    });
  });
  exports.emitInfoDelayed();
};

exports.publish = function (filter, msg) {
  if (!io) {
    log.debug("io connection not set up, publish skipped");
    return;
  }
  io.emit(filter, msg);
};

exports.emitInfoDelayed = function () {
  try {
    setTimeout(async function () {
      let data = await stats.getConvertedBalances();
      exports.publish("gdax", data);
      exports.emitInfoDelayed();
    }, 20000);
  } catch (error) {
    log.info(error);
  }
};
