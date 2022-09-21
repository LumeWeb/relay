import { start as startRpc } from "./rpc.js";
import { start as startRelay } from "./relay.js";
import { start as startApp } from "./app";
import log from "loglevel";
import config from "./config.js";
import { loadPlugins } from "./plugin.js";
import { start as startDns } from "./dns.js";
import { start as startSSl } from "./ssl.js";

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
