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
import { RELAY_SEED } from "./constant_vars";

let server: {
  listen: (arg0: ed25519Keypair) => void;
  ready: () => any;
};

async function start() {
  let [, err] = validSeedPhrase(RELAY_SEED as string);
  if (err !== null) {
    errorExit("RELAY_SEED is invalid. Aborting.");
  }

  const keyPair = deriveMyskyRootKeypair(
    seedPhraseToSeed(RELAY_SEED as string)[0]
  );

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
