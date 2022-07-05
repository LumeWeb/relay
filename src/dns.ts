import cron from "node-cron";
import fetch from "node-fetch";
import { get as getDHT } from "./dht.js";
import { overwriteRegistryEntry } from "libskynetnode";
import { Buffer } from "buffer";
import { blake2b } from "libskynet";
import { Parser } from "xml2js";
import { URL } from "url";
import { errorExit } from "./util.js";
import { pack } from "msgpackr";
import config from "./config.js";

const { createHash } = await import("crypto");

let activeIp: string;

const REGISTRY_DHT_KEY = "lumeweb-dht-relay";

async function ipUpdate() {
  let currentIp = await getCurrentIp();

  if (activeIp && currentIp === activeIp) {
    return;
  }

  let domain = await getDomainInfo();

  await fetch(domain.url[0].toString());

  activeIp = domain.address[0];
}

export async function start() {
  const dht = await getDHT();

  await ipUpdate();

  await overwriteRegistryEntry(
    dht.defaultKeyPair,
    hashDataKey(REGISTRY_DHT_KEY),
    pack(`${config.str("relay-domain")}:${config.uint("relay-port")}`)
  );

  cron.schedule("0 * * * *", ipUpdate);
}

function hashDataKey(dataKey: string): Uint8Array {
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

async function getDomainInfo() {
  const relayDomain = config.str("relay-domain");
  const parser = new Parser();

  const url = new URL("https://freedns.afraid.org/api/");

  const params = url.searchParams;

  params.append("action", "getdyndns");
  params.append("v", "2");
  params.append("style", "xml");

  const hash = createHash("sha1");
  hash.update(
    `${config.str("afraid-username")}|${config.str("afraid-password")}`
  );

  params.append("sha", hash.digest().toString("hex"));

  const response = await (await fetch(url.toString())).text();

  if (/could not authenticate/i.test(response)) {
    errorExit("Failed to authenticate to afraid.org");
  }

  const json = await parser.parseStringPromise(response);

  let domain = null;

  for (const item of json.xml.item) {
    if (item.host[0] === relayDomain) {
      domain = item;
      break;
    }
  }

  if (!domain) {
    errorExit(`Domain ${relayDomain} not found in afraid.org account`);
  }

  return domain;
}

async function getCurrentIp(): Promise<string> {
  const response = await (await fetch("http://checkip.dyndns.org")).text();
  const parser = new Parser();

  const html = await parser.parseStringPromise(response.trim());

  return html.html.body[0].split(":").pop();
}
