import { RpcMethodList } from "./index";

export default {
  ping: async () => {
    return { pong: true };
  },
} as RpcMethodList;
