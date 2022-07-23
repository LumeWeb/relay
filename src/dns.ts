import cron from "node-cron";
import fetch from "node-fetch";
import { get as getDHT } from "./dht.js";
import { overwriteRegistryEntry } from "libskynetnode";
import { Buffer } from "buffer";
import { Parser } from "xml2js";
import { URL } from "url";
import { pack } from "msgpackr";
import config from "./config.js";
import { hashDataKey } from "@lumeweb/kernel-utils";
import { errorExit } from "./error.js";

const { createHash } = await import("crypto");

let activeIp: string;

const REGISTRY_NODE_KEY = "lumeweb-dht-node";

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
  const dht = (await getDHT()) as any;

  await ipUpdate();

  await overwriteRegistryEntry(
    dht.defaultKeyPair,
    hashDataKey(REGISTRY_NODE_KEY),
    pack(`${config.str("domain")}:${config.uint("port")}`)
  );

  console.log(
    "node pubkey:",
    Buffer.from(dht.defaultKeyPair.publicKey).toString("hex")
  );

  cron.schedule("0 * * * *", ipUpdate);
}

async function getDomainInfo() {
  const relayDomain = config.str("domain");
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
  return await (await fetch("http://ip1.dynupdate.no-ip.com/")).text();
}
