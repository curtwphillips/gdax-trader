Object.defineProperty(global, "__stack", {
  get: function () {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    const err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    const stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },
});

Object.defineProperty(global, "__line", {
  get: function () {
    return __stack[1].getLineNumber();
  },
});

Object.defineProperty(global, "__function", {
  get: function () {
    return __stack[1].getFunctionName();
  },
});

Object.defineProperty(global, "__clear", {
  get: function () {
    return process.stdout.write("\033[2J\033[0;0H");
  },
});
