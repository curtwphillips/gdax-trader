const globals = require("./lib/globals");
const config = require("./lib/config");
const path = require("path");
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const serveStatic = require("koa-static");
const router = require("koa-router")();
const routeCreator = require("./routeCreator");
const send = require("koa-send");
const cors = require("koa-cors");
const http = require("http");
const log = require("./lib/log");
const convert = require("koa-convert");
const sockets = require("./lib/sockets");
const PORT = config.server.port;
const BASE_URL = "http://localhost:" + PORT;
const INDEXPATH = "/public/index.html";
const utility = require("./lib/utility");
Error.stackTraceLimit = Infinity;

const app = new Koa();

routeCreator.create(app, router);

app
  .use(convert(cors({ origin: "*" })))
  .use(convert(serveStatic(path.join(__dirname, "public"))))
  .use(bodyParser())
  .use(async (ctx, next) => utility.logRequest(ctx, next))
  // .use(async (ctx, next) => auth.validate(ctx, next))
  .use(router.routes())
  .use(router.allowedMethods())
  .use(async (ctx) => await send(ctx, INDEXPATH));

const server = http.createServer(app.callback());
server.listen(PORT);
io = require("socket.io")(server);
log.debug(
  process.env.NODE_ENV + " server listening at http://localhost:" + PORT
);

const usersOnline = {};

sockets.init(io);
