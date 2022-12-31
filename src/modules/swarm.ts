//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import Hyperswarm from "hyperswarm";
// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import Protomux from "protomux";

// @ts-ignore
import sodium from "sodium-universal";
import b4a from "b4a";
import log from "../log.js";
import { getKeyPair } from "../lib/seed.js";

const LUMEWEB = b4a.from("lumeweb");
export const LUMEWEB_TOPIC_HASH = b4a.allocUnsafe(32);
sodium.crypto_generichash(LUMEWEB_TOPIC_HASH, LUMEWEB);

export type SecretStream = any;

let node: Hyperswarm;
let protocolManager: ProtocolManager;

export async function start() {
  const keyPair = getKeyPair();
  const bootstrap = DHT.bootstrapper(49737, "0.0.0.0");
  await bootstrap.ready();

  const address = bootstrap.address();
  node = new Hyperswarm({
    keyPair,
    dht: new DHT({
      keyPair,
      bootstrap: [{ host: address.host, port: address.port }].concat(
        require("@hyperswarm/dht/lib/constants").BOOTSTRAP_NODES
      ),
    }),
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

export class ProtocolManager {
  private _protocols: Map<string, Function> = new Map<string, Function>();
  private _swarm;

  constructor(swarm: any) {
    this._swarm = swarm;

    this._swarm.on("connection", (peer: any) => {
      for (const protocol of this._protocols) {
        Protomux.from(peer).pair(
          protocol[0],
          this.handler.bind(this, protocol[0], peer)
        );
      }
    });
  }

  private handler(protocol: string, peer: any) {
    if (this._protocols.has(protocol)) {
      this._protocols.get(protocol)?.(peer, Protomux.from(peer));
    }
  }

  public register(name: string, handler: Function): boolean {
    if (this._protocols.has(name)) {
      return false;
    }

    this._protocols.set(name, handler);
    return true;
  }
}

export function getProtocolManager(): ProtocolManager {
  if (!protocolManager) {
    protocolManager = new ProtocolManager(get());
  }

  return protocolManager;
}
