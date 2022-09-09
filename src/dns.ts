import cron from "node-cron";
import { get as getDHT } from "./dht.js";
import { Buffer } from "buffer";
import { pack } from "msgpackr";
import config from "./config.js";
import log from "loglevel";
import { dynImport } from "./util.js";
import type { DnsProvider } from "@lumeweb/relay-types";

let activeIp: string;
let fetch: typeof import("node-fetch").default;
let overwriteRegistryEntry: typeof import("libskynetnode").overwriteRegistryEntry;
let hashDataKey: typeof import("@lumeweb/kernel-utils").hashDataKey;

const REGISTRY_NODE_KEY = "lumeweb-dht-node";

let dnsProvider: DnsProvider = async (ip) => {};

export function setDnsProvider(provider: DnsProvider) {
  dnsProvider = provider;
}

async function ipUpdate() {
  let currentIp = await getCurrentIp();

  if (activeIp && currentIp === activeIp) {
    return;
  }

  await dnsProvider(currentIp);

  activeIp = currentIp;

  log.info(`Updated DynDNS hostname ${config.str("domain")} to ${activeIp}`);
}

export async function start() {
  fetch = (await dynImport("node-fetch")).default;
  overwriteRegistryEntry = (await dynImport("libskynetnode"))
    .overwriteRegistryEntry;
  hashDataKey = (await dynImport("@lumeweb/kernel-utils")).hashDataKey;

  const dht = (await getDHT()) as any;

  await ipUpdate();

  await overwriteRegistryEntry(
    dht.defaultKeyPair,
    hashDataKey(REGISTRY_NODE_KEY),
    pack(`${config.str("domain")}:${config.uint("port")}`)
  );

  log.info(
    "Relay Identity is",
    Buffer.from(dht.defaultKeyPair.publicKey).toString("hex")
  );

  cron.schedule("0 * * * *", ipUpdate);
}

async function getCurrentIp(): Promise<string> {
  return await (await fetch("http://ip1.dynupdate.no-ip.com/")).text();
}
