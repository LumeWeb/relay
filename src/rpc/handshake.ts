import { createRequire } from "module";
import { RpcMethodList } from "./index.js";
// @ts-ignore
import rand from "random-key";
// @ts-ignore
import SPVNode from "hsd/lib/node/spvnode.js";
import {
  HSD_API_KEY,
  HSD_HOST,
  HSD_NETWORK_TYPE,
  HSD_PORT,
  HSD_USE_EXTERNAL_NODE,
} from "../constants.js";

const require = createRequire(import.meta.url);

const { NodeClient } = require("hs-client");

let hsdServer: SPVNode;

let clientArgs = {
  network: "main",
  host: "127.0.0.1",
  port: 12037,
  apiKey: rand.generate(),
};

if (!HSD_USE_EXTERNAL_NODE) {
  process.env.HSD_NO_DNS = "true";
  process.env.HSD_NO_RS = "true";
  process.env.HSD_HTTP_HOST = "127.0.0.1";
  process.env.HSD_API_KEY = clientArgs.apiKey;
  hsdServer = new SPVNode({
    config: false,
    argv: false,
    env: true,
    logFile: false,
    logConsole: false,
    logLevel: "info",
    memory: false,
    workers: true,
    listen: false,
    network: "main",
    loader: require,
  });
} else {
  clientArgs = {
    network: HSD_NETWORK_TYPE,
    host: HSD_HOST,
    port: HSD_PORT,
    apiKey: HSD_API_KEY,
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
