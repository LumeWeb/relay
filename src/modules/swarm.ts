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
  const topic = b4a.allocUnsafe(32);
  sodium.crypto_generichash(topic, LUMEWEB);

  // @ts-ignore
  await node.dht.ready();
  await node.listen();
  node.join(topic);

  return node;
}

export function get(): Hyperswarm {
  return node;
}
