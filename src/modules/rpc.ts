//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import config from "../config.js";
import { errorExit } from "../lib/error.js";
// @ts-ignore
import stringify from "json-stable-stringify";
import { getRpcServer, RPC_PROTOCOL_SYMBOL } from "./rpc/server.js";
import { get as getSwarm, SecretStream } from "./swarm.js";
import b4a from "b4a";

export async function start() {
  if (!config.str("pocket-app-id") || !config.str("pocket-app-key")) {
    errorExit("Please set pocket-app-id and pocket-app-key config options.");
  }

  getSwarm().on("connection", (stream: SecretStream) =>
    getRpcServer().setup(stream)
  );
}

export async function getRpcByPeer(peer: Buffer | string) {
  const swarm = getSwarm();
  peer = b4a.from(peer) as Buffer;

  if (swarm._allConnections.has(peer)) {
    return swarm._allConnections.get(peer)[RPC_PROTOCOL_SYMBOL];
  }

  return new Promise((resolve) => {
    const listener = () => {};
    swarm.on("connection", (peer: any, info: any) => {
      if (info.publicKey.toString("hex") !== peer.toString("hex")) {
        return;
      }
      swarm.removeListener("connection", listener);

      resolve(peer[RPC_PROTOCOL_SYMBOL]);
    });

    swarm.joinPeer(peer);
  });
}
