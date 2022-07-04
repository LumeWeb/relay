import { RpcMethodList } from "./index.js";
import {
  HSD_API_KEY,
  HSD_HOST,
  HSD_NETWORK_TYPE,
  HSD_PORT,
} from "../constant_vars.js";

const { NodeClient } = require("hs-client");

const hnsClient = new NodeClient({
  network: HSD_NETWORK_TYPE,
  host: HSD_HOST,
  port: HSD_PORT,
  apiKey: HSD_API_KEY,
});

export default {
  getnameresource: async function (args: any, context: object) {
    // @ts-ignore
    if ("hns" !== context.chain) {
      throw new Error("Invalid Chain");
    }

    return await hnsClient.execute("getnameresource", args);
  },
} as RpcMethodList;
