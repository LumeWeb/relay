import { start as startRpc } from "./rpc.js";
import { start as startRelay } from "./relay.js";

startRelay();
startRpc();

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
});

export {};
