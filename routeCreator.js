const fs = require("fs");

exports.create = function (app, router) {
  const api = readFiles(__dirname + "/routes/", app);
  createRoutes(api, app, router, "/api");
  return api;
};

function readFiles(dir, app) {
  const api = [];
  if (fs.lstatSync(dir).isDirectory()) {
    const files = fs.readdirSync(dir);
    for (var i in files) {
      const file = files[i];
      const stat = fs.statSync(dir + "/" + file);
      if (stat.isDirectory()) {
        api[file] = readFiles(dir + "/" + file, app);
      } else {
        if (file.match(/\.js$/)) {
          const route = file.replace(".js", "");
          api[route] = require(dir + "/" + file);
        }
      }
    }
  }
  return api;
}

function createRoutes(api, app, router, url) {
  for (let routeFn in api) {
    const obj = api[routeFn];
    const routeUrl = url + "/" + routeFn;
    if (obj.routes) {
      for (let i in obj.routes) {
        if (obj.routes[i].type == "post") {
          router.post(routeUrl + obj.routes[i].route, obj.routes[i].handler);
        } else if (obj.routes[i].type == "get") {
          router.get(routeUrl + obj.routes[i].route, obj.routes[i].handler);
        } else if (obj.routes[i].type == "put") {
          router.put(routeUrl + obj.routes[i].route, obj.routes[i].handler);
        }
        if (obj.routes[i].type == "delete") {
          router.delete(routeUrl + obj.routes[i].route, obj.routes[i].handler);
        }
      }
    }
    if (Array.isArray(obj)) {
      createRoutes(obj, app, router, url + "/" + routeFn);
      continue;
    }
    if (obj.findAll) {
      router.get(routeUrl, obj.findAll);
    }
    if (obj.findById) {
      router.get(routeUrl + "/:id", obj.findById);
    }
    if (obj.create) {
      router.post(routeUrl, obj.create);
    }
    if (obj.update) {
      router.put(routeUrl + "/:id", obj.update);
    }
    if (obj.destroy) {
      router.delete(routeUrl + "/:id", obj.destroy);
    }
  }
}
