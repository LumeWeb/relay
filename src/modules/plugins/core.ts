import { Plugin, PluginAPI } from "@lumeweb/relay-types";
import { getRpcServer } from "../rpc/server";

const plugin: Plugin = {
  name: "core",
  async plugin(api: PluginAPI): Promise<void> {
    api.registerMethod("ping", {
      cacheable: false,
      async handler(): Promise<any> {
        return "pong";
      },
    });

    api.registerMethod("get_methods", {
      cacheable: false,
      async handler(): Promise<any> {
        return api.rpcServer.getMethods();
      },
    });
  },
};

export default plugin;
