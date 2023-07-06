// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import config from "../config.js";
import { get as getSwarm } from "./swarm.js";
// @ts-ignore
import log from "../log.js";
import { AddressInfo } from "net";
// @ts-ignore
import promiseRetry from "promise-retry";
import fastify from "fastify";
import * as http2 from "http2";
import websocket from "@fastify/websocket";

export async function start() {
  const swarm = getSwarm();

  let relayServer = fastify({
    logger: log.child({ module: "relay-server" }),
  });

  await relayServer.register(websocket);

  relayServer.get("/", { websocket: true }, (connection) => {
    relay(swarm.dht, new Stream(false, connection.socket));
    connection.socket.binaryType = "nodebuffer";
  });

  let port = config.uint("core.relayPort");

  if (!port) {
    port = config.uint("core.port");
  }

  await relayServer.listen({ port, host: "0.0.0.0" });
}
