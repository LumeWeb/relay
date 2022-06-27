import WS from "ws";

// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { get as getDHT } from "./dht.js";
import { overwriteRegistryEntry } from "libskynetnode/dist";
import { Buffer } from "buffer";
import { blake2b } from "libskynet/dist";

export async function start() {
  const RELAY_PORT = process.env.RELAY_PORT ?? (8080 as unknown as string);

  const server = new WS.Server({
    port: RELAY_PORT as unknown as number,
  });

  const dht = await getDHT();

  await overwriteRegistryEntry(
    dht.defaultKeyPair,
    hashDataKey("lume-dht-relay"),
    stringToUint8ArrayUtf8(`${dht.localAddress()}:${RELAY_PORT}`)
  );

  server.on("connection", (socket) => {
    relay(dht, new Stream(false, socket));
  });
}

export function hashDataKey(dataKey: string): Uint8Array {
  return blake2b(encodeUtf8String(dataKey));
}

function encodeUtf8String(str: string): Uint8Array {
  const byteArray = stringToUint8ArrayUtf8(str);
  const encoded = new Uint8Array(8 + byteArray.length);
  encoded.set(encodeNumber(byteArray.length));
  encoded.set(byteArray, 8);
  return encoded;
}

function stringToUint8ArrayUtf8(str: string): Uint8Array {
  return Uint8Array.from(Buffer.from(str, "utf-8"));
}

function encodeNumber(num: number): Uint8Array {
  const encoded = new Uint8Array(8);
  for (let index = 0; index < encoded.length; index++) {
    encoded[index] = num & 0xff;
    num = num >> 8;
  }
  return encoded;
}
