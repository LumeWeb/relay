import { Plugin, PluginAPI } from "@lumeweb/interface-relay";

import defer from "p-defer";

const plugin: Plugin = {
  name: "core",
  async plugin(api: PluginAPI): Promise<void> {
    const pluginsLoaded = defer();
    api.once("core.pluginsLoaded", () => {
      pluginsLoaded.resolve();
    });

    api.registerMethod("ping", {
      cacheable: false,
      async handler(): Promise<any> {
        return "pong";
      },
    });

    api.registerMethod("get_methods", {
      cacheable: false,
      async handler(): Promise<any> {
        await pluginsLoaded.promise;

        return api.rpcServer.getMethods();
      },
    });
  },
};

export default plugin;
