import { proxyRpcMethod } from "./common.js";
import { RpcMethodList } from "./index.js";
import chainNetworks from "@lumeweb/pokt-rpc-endpoints";

export default {
  getAccountInfo: proxyRpcMethod("getAccountInfo", [
    chainNetworks["solana-mainnet"],
  ]),
} as RpcMethodList;
