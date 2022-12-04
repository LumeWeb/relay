//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import Hyperswarm from "hyperswarm";
// @ts-ignore
import DHT from "@hyperswarm/dht";
import config from "../config.js";
import { errorExit } from "../lib/error.js";
import {
  deriveMyskyRootKeypair,
  seedPhraseToSeed,
  validSeedPhrase,
} from "libskynet";

// @ts-ignore
import sodium from "sodium-universal";
import b4a from "b4a";

const LUMEWEB = b4a.from("lumeweb");
export const LUMEWEB_TOPIC_HASH = b4a.allocUnsafe(32);
sodium.crypto_generichash(LUMEWEB_TOPIC_HASH, LUMEWEB);

export type SecretStream = any;

let node: Hyperswarm;

export function getKeyPair() {
  const seed = config.str("seed");

  let err = validSeedPhrase(seed);
  if (err !== null) {
    errorExit("LUME_WEB_RELAY_SEED is invalid. Aborting.");
  }

  return deriveMyskyRootKeypair(seedPhraseToSeed(seed)[0]);
}

export async function start() {
  const keyPair = getKeyPair();

  node = new Hyperswarm({ keyPair, dht: new DHT({ keyPair }) });

  // @ts-ignore
  await node.dht.ready();
  await node.listen();
  node.join(LUMEWEB_TOPIC_HASH);

  return node;
}

export function get(): Hyperswarm {
  return node;
}
