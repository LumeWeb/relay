//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import config from "../config.js";
import { errorExit } from "../lib/error.js";
// @ts-ignore
import stringify from "json-stable-stringify";
import {
  getRpcServer,
  RPC_PROTOCOL_ID,
  RPC_PROTOCOL_SYMBOL,
  setupStream,
} from "./rpc/server.js";
import { get as getSwarm, SecretStream } from "./swarm.js";
import b4a from "b4a";
// @ts-ignore
import Protomux from "protomux";

export async function start() {
  getSwarm().on("connection", (stream: SecretStream) => {
    Protomux.from(stream).pair(
      { protocol: "protomux-rpc", id: RPC_PROTOCOL_ID },
      async () => {
        getRpcServer().setup(stream);
      }
    );
  });
}

export async function getRpcByPeer(peer: Buffer | string) {
  const swarm = getSwarm();
  if (!b4a.isBuffer(peer)) {
    peer = b4a.from(peer, "hex") as Buffer;
  }

  if (swarm._allConnections.has(peer)) {
    return swarm._allConnections.get(peer)[RPC_PROTOCOL_SYMBOL];
  }

  return new Promise((resolve) => {
    const listener = (peer: any, info: any) => {
      if (info.publicKey.toString("hex") !== peer.toString("hex")) {
        return;
      }
      swarm.removeListener("connection", listener);

      resolve(setupStream(peer));
    };

    swarm.on("connection", listener);

    swarm.joinPeer(peer);
  });
}
