import { createRequire } from "module";
const require = createRequire(import.meta.url);
const DHT = require("@hyperswarm/dht");
import { errorExit } from "./util.js";
import {
  deriveMyskyRootKeypair,
  ed25519Keypair,
  seedPhraseToSeed,
  validSeedPhrase,
} from "libskynet";
import config from "./config.js";

let server: {
  listen: (arg0: ed25519Keypair) => void;
  ready: () => any;
};

async function start() {
  const seed = config.str("relay-seed");

  let [, err] = validSeedPhrase(seed);
  if (err !== null) {
    errorExit("RELAY_SEED is invalid. Aborting.");
  }

  const keyPair = deriveMyskyRootKeypair(seedPhraseToSeed(seed)[0]);

  const node = new DHT({ keyPair });

  await node.ready();

  return (server = node);
}

export async function get() {
  if (!server) {
    return start();
  }

  return server;
}
