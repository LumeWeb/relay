import { createRequire } from "module";

const require = createRequire(import.meta.url);
const DHT = require("@hyperswarm/dht");
import { errorExit } from "./util.js";
import {
  deriveMyskyRootKeypair,
  Ed25519Keypair,
  seedPhraseToSeed,
  validSeedPhrase,
} from "libskynet";
import config from "./config.js";

let node: {
  ready: () => any;
  createServer: () => any;
  defaultKeyPair: any;
  on: any;
};
let server: {
  listen: (arg0: Ed25519Keypair) => any;
  on: any;
};

async function start() {
  const seed = config.str("seed");

  let err = validSeedPhrase(seed);
  if (err !== null) {
    errorExit("RELAY_SEED is invalid. Aborting.");
  }

  const keyPair = deriveMyskyRootKeypair(seedPhraseToSeed(seed)[0]);

  node = new DHT({ keyPair });

  await node.ready();

  server = node.createServer();
  await server.listen(keyPair);

  return node;
}

export async function get(
  ret: "server" | "dht" = "dht"
): Promise<typeof server | typeof node> {
  if (!node) {
    await start();
  }

  if (ret == "server") {
    return server;
  }

  return node;
}
