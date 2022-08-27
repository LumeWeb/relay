import { start as startRpc } from "./rpc.js";
import { start as startRelay } from "./relay.js";
import log from "loglevel";
import config from "./config.js";
import { loadPlugins } from "./plugin.js";

log.setDefaultLevel(config.str("log-level"));

async function boot() {
  await startRpc();
  await loadPlugins();
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
