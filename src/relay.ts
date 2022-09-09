// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import express, { Express } from "express";
import config from "./config.js";
import * as http from "http";
import * as https from "https";
import { get as getDHT } from "./dht.js";
import WS from "ws";
// @ts-ignore
import log from "loglevel";
import { AddressInfo } from "net";
// @ts-ignore
import promiseRetry from "promise-retry";
import { getSslContext } from "./ssl.js";

let app: Express;
let router = express.Router();

export function getRouter(): express.Router {
  return router;
}

export function setRouter(newRouter: express.Router): void {
  router = newRouter;
}

export function resetRouter(): void {
  setRouter(express.Router());
}

export async function start() {
  const relayPort = config.uint("port");
  app = express();
  app.use(function (req, res, next) {
    router(req, res, next);
  });

  let httpServer = http.createServer(app);

  await new Promise((resolve) => {
    httpServer.listen(80, "0.0.0.0", function () {
      const address = httpServer.address() as AddressInfo;
      log.info("HTTP Server started on ", `${address.address}:${address.port}`);
      resolve(null);
    });
  });
  const dht = await getDHT();

  const statusCodeServer = http.createServer(function (req, res) {
    // @ts-ignore
    res.writeHead(req.headers["x-status"] ?? 200, {
      "Content-Type": "text/plain",
    });
    res.end();
  });

  await new Promise((resolve) => {
    statusCodeServer.listen(25252, "0.0.0.0", function () {
      const address = statusCodeServer.address() as AddressInfo;
      log.info(
        "Status Code Server started on ",
        `${address.address}:${address.port}`
      );
      resolve(null);
    });
  });

  let relayServer: https.Server | http.Server;

  if (config.bool("ssl")) {
    relayServer = https.createServer({
      SNICallback(servername, cb) {
        cb(null, getSslContext());
      },
    });
  } else {
    relayServer = http.createServer();
  }

  let wsServer = new WS.Server({ server: relayServer });

  wsServer.on("connection", (socket: any) => {
    relay(dht, new Stream(false, socket));
  });

  await new Promise((resolve) => {
    relayServer.listen(relayPort, "0.0.0.0", function () {
      const address = relayServer.address() as AddressInfo;
      log.info(
        "DHT Relay Server started on ",
        `${address.address}:${address.port}`
      );
      resolve(null);
    });
  });
}
