import { start as startRpc } from "./modules/rpc.js";
import { start as startRelay } from "./modules/relay.js";
import { start as startApp } from "./modules/app";
import log from "loglevel";
import config from "./config.js";
import { loadPlugins } from "./modules/plugin.js";
import { start as startSwarm } from "./modules/swarm.js";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

log.setDefaultLevel(config.str("log-level"));

if (!config.str("seed")) {
  config.saveConfigJson("account.json", {
    seed: bip39.generateMnemonic(wordlist),
  });
}

async function boot() {
  await startSwarm();
  await loadPlugins();
  await startApp();
  await startRpc();
  await startRelay();
}

boot();

process.on("uncaughtException", function (err) {
  console.log(`Caught exception: ${err.message} ${err.stack}`);
});
process.on("SIGINT", function () {
  process.exit();
});
process.on("SIGTERM", function () {
  process.exit();
});
