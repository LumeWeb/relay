import { start as startRpc } from "./modules/rpc.js";
import { start as startRelay } from "./modules/relay.js";
import { start as startApp } from "./modules/app";
import config from "./config.js";
import { getPluginAPI, loadPlugins } from "./modules/plugin.js";
import { start as startSwarm, get as getSwarm } from "./modules/swarm.js";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

if (!config.str("core.seed")) {
  config.save("account", {
    core: {
      seed: bip39.generateMnemonic(wordlist),
    },
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

async function shutdown() {
  await getPluginAPI().emitAsync("core.shutdown");
  await getSwarm().destroy();
  process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
