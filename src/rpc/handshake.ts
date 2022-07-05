import { RpcMethodList } from "./index.js";
// @ts-ignore
import rand from "random-key";
// @ts-ignore
import SPVNode from "hsd/lib/node/spvnode.js";
import config from "../config.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { NodeClient } = require("hs-client");

let hsdServer: SPVNode;

let clientArgs = {
  network: "main",
  host: "127.0.0.1",
  port: 12037,
  apiKey: rand.generate(),
};

if (!config.bool("hsd-use-extenal-node")) {
  hsdServer = new SPVNode({
    config: false,
    argv: false,
    env: true,
    noDns: true,
    httpHost: "127.0.0.1",
    apiKey: clientArgs.apiKey,
    logFile: false,
    logConsole: false,
    logLevel: "info",
    workers: true,
    network: "main",
  });
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
  getnameresource: async function (args: any, context: object) {
    // @ts-ignore
    if ("hns" !== context.chain) {
      throw new Error("Invalid Chain");
    }

    return await hnsClient.execute("getnameresource", args);
  },
} as RpcMethodList;
