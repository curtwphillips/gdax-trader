// socket communicating with the portal node server

let sockets = (function () {
  let filters;

  function init() {
    filters = [
      {
        topic: "gdax",
        listener: live,
      },
    ];
    try {
      // gdax must be imported
      let options = { forceNew: true };
      let io_portal;
      if (portal.env === "local") {
        io_portal = io.connect("http://localhost:3345", options);
      }
      receiveTopicMessages(io_portal);
    } catch (error) {
      // retry
      setTimeout(function () {
        init();
      }, 50);
    }
  }

  function receiveTopicMessages(io_portal) {
    try {
      filters.forEach(function (filter) {
        if (filter.listener.receive) {
          io_portal.on(filter.topic, function (msg) {
            filter.listener.receive(msg);
          });
        }
      });
    } catch (error) {
      // retry
      setTimeout(function () {
        receiveTopicMessages(io_portal);
      }, 50);
    }
  }

  return {
    init: init,
  };
})();
