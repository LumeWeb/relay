import express, { Express } from "express";
import http from "http";
import { AddressInfo } from "net";
import log from "loglevel";

let app: Express;
let router = express.Router();
let server: http.Server;

export function getRouter(): express.Router {
  return router;
}

export function setRouter(newRouter: express.Router): void {
  router = newRouter;
}

export async function start() {
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(80, "0.0.0.0", function () {
      const address = server.address() as AddressInfo;
      log.info(
        "HTTP/App Server started on ",
        `${address.address}:${address.port}`
      );
      resolve(null);
    });
  });
  app = express();
  app.use(function (req, res, next) {
    router(req, res, next);
  });
}

export function getApp(): Express {
  return app;
}
export function getServer(): http.Server {
  return server;
}

export function resetRouter(): void {
  setRouter(express.Router());
}
