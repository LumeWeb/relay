//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import DHT from "@hyperswarm/dht";
import config from "../config.js";
import { errorExit } from "../lib/error.js";
import {
  deriveMyskyRootKeypair,
  seedPhraseToSeed,
  validSeedPhrase,
} from "libskynet";

let node: {
  ready: () => any;
  createServer: () => any;
  defaultKeyPair: any;
  on: any;
};
let server: any;

export function getKeyPair() {
  const seed = config.str("seed");

  let err = validSeedPhrase(seed);
  if (err !== null) {
    errorExit("LUME_WEB_RELAY_SEED is invalid. Aborting.");
  }

  return deriveMyskyRootKeypair(seedPhraseToSeed(seed)[0]);
}

async function start() {
  const keyPair = getKeyPair();

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
