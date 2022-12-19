// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import config from "../config.js";
import { get as getSwarm } from "./swarm.js";
import { get as getSslManager } from "./ssl.js";
// @ts-ignore
import log from "../log.js";
import { AddressInfo } from "net";
// @ts-ignore
import promiseRetry from "promise-retry";
import fastify from "fastify";
import * as http2 from "http2";
import websocket from "@fastify/websocket";

export async function start() {
  const dht = getSwarm();
  let sslOptions: boolean | http2.SecureServerOptions = false;

  if (getSslManager().enabled) {
    sslOptions = {
      SNICallback: () => getSslManager().context,
    } as http2.SecureServerOptions;
  }

  let relayServer = fastify({
    http2: true,
    https: sslOptions as http2.SecureServerOptions,
    logger: log.child({ module: "relay-server" }),
  });

  relayServer.register(websocket);

  relayServer.get("/", { websocket: true }, (connection) => {
    relay(dht, new Stream(false, connection.socket));
  });

  await relayServer.listen({ port: config.uint("port"), host: "0.0.0.0" });
}
