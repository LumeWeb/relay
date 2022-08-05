import { RpcMethodList, validateChain } from "./index.js";

export default {
  ping: validateChain("misc", async () => {
    return { pong: true };
  }),
} as RpcMethodList;
