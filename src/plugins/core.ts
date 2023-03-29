import { Plugin, PluginAPI } from "@lumeweb/relay-types";

let pluginsLoadedResolve: () => void;
let pluginsLoadedPromise = new Promise<void>((resolve) => {
  pluginsLoadedResolve = resolve;
});

const plugin: Plugin = {
  name: "core",
  async plugin(api: PluginAPI): Promise<void> {
    api.once("core.pluginsLoaded", () => {
      pluginsLoadedResolve();
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
        await pluginsLoadedPromise;

        console.log("get_methods", api.rpcServer.getMethods());

        return api.rpcServer.getMethods();
      },
    });
  },
};

export default plugin;
