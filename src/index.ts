import { start as startRpc } from "./modules/rpc.js";
import { start as startRelay } from "./modules/relay.js";
import { start as startApp } from "./modules/app";
import log from "loglevel";
import config from "./config.js";
import { loadPlugins } from "./modules/plugin.js";
import { start as startDns } from "./modules/dns.js";
import { start as startSSl } from "./modules/ssl.js";

log.setDefaultLevel(config.str("log-level"));

async function boot() {
  await loadPlugins();
  await startApp();
  await startRpc();
  await startDns();
  await startSSl();
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
