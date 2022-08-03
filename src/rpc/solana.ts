import { proxyRpcMethod } from "./common.js";
import { RpcMethodList } from "./index.js";
import chainNetworks from "../networks.json";

export default {
  getAccountInfo: proxyRpcMethod("getAccountInfo", [
    chainNetworks["sol-mainnet"],
  ]),
} as RpcMethodList;
