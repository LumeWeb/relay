import { chainNetworks, proxyRpcMethod } from "./common.js";
import { RpcMethodList } from "./index.js";

export default {
  getAccountInfo: proxyRpcMethod("getAccountInfo", [
    chainNetworks["sol-mainnet"],
  ]),
} as RpcMethodList;
