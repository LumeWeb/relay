import { start as startRpc } from "./rpc.js";
import { start as startRelay } from "./relay.js";
import log from "loglevel";
import config from "./config";

log.setDefaultLevel(config.str("log-level"));

async function boot() {
  await startRpc();
  await startRelay();
}

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
});

export {};
