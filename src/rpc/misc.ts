import { RpcMethodList, rpcMethods, validateChain } from "./index.js";

const CHAIN = "misc";

export default {
  ping: validateChain(CHAIN, async () => {
    return { pong: true };
  }),
  get_methods: validateChain(CHAIN, async () => {
    return Object.keys(rpcMethods);
  }),
} as RpcMethodList;
