import {start as startDns} from "./dns.js";
import {start as startRpc} from "./rpc.js";
import {start as startRelay} from "./relay.js";

await startDns();
await startRpc();
await startRelay();

process.on("uncaughtException", function (err) {
    console.log("Caught exception: " + err);
});

export {};
