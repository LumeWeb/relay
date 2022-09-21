//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import DHT from "@hyperswarm/dht";
import config from "./config.js";
import { errorExit } from "./error.js";
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
