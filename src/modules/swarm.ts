//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import Hyperswarm from "hyperswarm";
// @ts-ignore
import DHT from "@hyperswarm/dht";

// @ts-ignore
import sodium from "sodium-universal";
import b4a from "b4a";
import log from "../log.js";
import { getKeyPair } from "../lib/seed.js";
import { AddressInfo } from "net";

const LUMEWEB = b4a.from("lumeweb");
export const LUMEWEB_TOPIC_HASH = b4a.allocUnsafe(32);
sodium.crypto_generichash(LUMEWEB_TOPIC_HASH, LUMEWEB);

export type SecretStream = any;

let node: Hyperswarm;

export async function start() {
  const keyPair = getKeyPair();
  const bootstrap = DHT.bootstrapper(49737, "0.0.0.0");
  await bootstrap.ready();

  const address = bootstrap.address() as AddressInfo;
  node = new Hyperswarm({
    keyPair,
    dht: new DHT({ keyPair }),
    bootstrap: [{ host: address.address, port: address.port }].concat(
      require("@hyperswarm/dht/lib/constants").BOOTSTRAP_NODES
    ),
  });

  // @ts-ignore
  await node.dht.ready();
  await node.listen();
  node.join(LUMEWEB_TOPIC_HASH);

  log.info(
    "Relay Identity is %s",
    b4a.from(getKeyPair().publicKey).toString("hex")
  );

  return node;
}

export function get(): Hyperswarm {
  return node;
}
