import cron from "node-cron";
import { get as getSwarm } from "./swarm.js";
import { Buffer } from "buffer";
import { pack } from "msgpackr";
import config from "../config.js";
import log from "loglevel";
import fetch from "node-fetch";
import { overwriteRegistryEntry } from "libskynetnode";
import type { DnsProvider } from "@lumeweb/relay-types";
// @ts-ignore
import { hashDataKey } from "@lumeweb/kernel-utils";

let activeIp: string;
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

  const domain = config.str("domain");

  await dnsProvider(currentIp, domain);

  activeIp = currentIp;

  log.info(`Updated DynDNS hostname ${domain} to ${activeIp}`);
}

export async function start() {
  const swarm = (await getSwarm()) as any;

  await ipUpdate();

  await overwriteRegistryEntry(
    swarm.dht.defaultKeyPair,
    hashDataKey(REGISTRY_NODE_KEY),
    pack(`${config.str("domain")}:${config.uint("port")}`)
  );

  log.info(
    "Relay Identity is",
    Buffer.from(swarm.dht.defaultKeyPair.publicKey).toString("hex")
  );

  cron.schedule("0 * * * *", ipUpdate);
}

async function getCurrentIp(): Promise<string> {
  return await (await fetch("http://ip1.dynupdate.no-ip.com/")).text();
}
