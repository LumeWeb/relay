//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import { rpcError, RpcMethodList } from "./index.js";
// @ts-ignore
import rand from "random-key";
// @ts-ignore
import SPVNode from "hsd/lib/node/spvnode.js";
import config from "../config.js";
import { ERR_INVALID_CHAIN, ERR_NOT_READY } from "../error.js";
// @ts-ignore
import { NodeClient } from "hs-client";

let hsdServer: SPVNode;

let clientArgs = {
  network: "main",
  host: "127.0.0.1",
  port: 12037,
  apiKey: rand.generate(),
};

if (!config.bool("hsd-use-external-node")) {
  hsdServer = new SPVNode({
    config: false,
    argv: false,
    env: true,
    noDns: true,
    memory: false,
    httpHost: "127.0.0.1",
    apiKey: clientArgs.apiKey,
    logFile: false,
    logConsole: true,
    logLevel: "info",
    workers: true,
    network: "main",
  });
  hsdServer.on("abort", async (err: any) => {
    const timeout = setTimeout(() => {
      console.error("Shutdown is taking a long time. Exiting.");
      process.exit(3);
    }, 5000);

    timeout.unref();

    try {
      console.error("Shutting down...");
      await hsdServer.close();
      clearTimeout(timeout);
      console.error((err as Error).stack);
      process.exit(2);
    } catch (e: any) {
      console.error(`Error occurred during shutdown: ${(e as Error).message}`);
      process.exit(3);
    }
  });

  (async () => {
    try {
      await hsdServer.ensure();
      await hsdServer.open();
      await hsdServer.connect();

      hsdServer.startSync();
    } catch (e: any) {
      console.error((e as Error).stack);
    }
  })();
} else {
  clientArgs = {
    network: config.str("hsd-network-type"),
    host: config.str("hsd-host"),
    port: config.uint("hsd-port"),
    apiKey: config.str("hsd-api-key"),
  };
}

const hnsClient = new NodeClient(clientArgs);

export default {
  getnameresource: async (args: any, context: object) => {
    // @ts-ignore
    if ("hns" !== context.chain) {
      throw rpcError(ERR_INVALID_CHAIN);
    }

    let resp;
    try {
      resp = await hnsClient.execute("getnameresource", args);
    } catch (e: any) {
      e = e as Error;
      const eType = e.type.toLowerCase();
      const eMessage = e.message.toLowerCase();

      if (eType === "rpcerror" && eMessage.includes("chain is not synced")) {
        return rpcError(ERR_NOT_READY);
      }

      return rpcError(eMessage);
    }

    return resp;
  },
} as RpcMethodList;
