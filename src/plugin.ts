import { globby } from "globby";
import config from "./config.js";
import { getRpcServer } from "./rpc/server.js";
import { RelayPluginAPI, RPCMethod, Plugin } from "./types.js";
import slugify from "slugify";

let pluginApi: PluginAPI;

const sanitizeName = (name: string) =>
  slugify(name, { lower: true, strict: true });

export class PluginAPI {
  private registeredPlugins: Map<string, Plugin> = new Map<string, Plugin>();

  public async loadPlugin(moduleName: string): Promise<Plugin> {
    moduleName = sanitizeName(moduleName);

    if (this.registeredPlugins.has(moduleName)) {
      return this.registeredPlugins.get(moduleName) as Plugin;
    }

    const paths = await globby([`${moduleName}.js`, "${moduleName}.mjs"], {
      cwd: config.get("plugin-folder"),
    });

    if (!paths.length) {
      throw new Error(`Plugin ${moduleName} does not exist`);
    }

    let plugin: Plugin;
    try {
      plugin = (await import(paths.shift() as string)) as Plugin;
    } catch (e) {
      throw e;
    }

    plugin.name = sanitizeName(plugin.name);

    this.registeredPlugins.set(plugin.name, plugin);

    try {
      plugin.plugin(this.getPluginAPI(plugin.name));
    } catch (e) {
      throw e;
    }

    return plugin;
  }

  private getPluginAPI(pluginName: string): RelayPluginAPI {
    return {
      config,
      registerMethod: (methodName: string, method: RPCMethod): void => {
        getRpcServer().registerMethod(pluginName, methodName, method);
      },
      loadPlugin: getPluginAPI().loadPlugin,
    };
  }
}

export function getPluginAPI(): PluginAPI {
  if (!pluginApi) {
    pluginApi = new PluginAPI();
  }

  return pluginApi as PluginAPI;
}

export async function loadPlugins() {
  for (const plugin of config.array("plugins")) {
    await getPluginAPI().loadPlugin(plugin);
  }
}
