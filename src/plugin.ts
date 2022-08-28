import config from "./config.js";
import { getRpcServer } from "./rpc/server.js";
import { PluginAPI, RPCMethod, Plugin } from "./types.js";
import slugify from "slugify";
import * as fs from "fs";
import path from "path";

let pluginApi: PluginApiManager;

const sanitizeName = (name: string) =>
  slugify(name, { lower: true, strict: true });

export class PluginApiManager {
  private registeredPlugins: Map<string, Plugin> = new Map<string, Plugin>();

  public async loadPlugin(moduleName: string): Promise<Plugin> {
    moduleName = sanitizeName(moduleName);

    if (this.registeredPlugins.has(moduleName)) {
      return this.registeredPlugins.get(moduleName) as Plugin;
    }

    const paths = [];
    for (const modulePath of [`${moduleName}.js`, `${moduleName}.mjs`]) {
      const fullPath = path.join(config.get("plugin-folder"), modulePath);
      if (fs.existsSync(fullPath)) {
        paths.push(fullPath);
        break;
      }
    }

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

  private getPluginAPI(pluginName: string): PluginAPI {
    return {
      config,
      registerMethod: (methodName: string, method: RPCMethod): void => {
        getRpcServer().registerMethod(pluginName, methodName, method);
      },
      loadPlugin: getPluginAPI().loadPlugin,
      getMethods: getRpcServer().getMethods,
    };
  }
}

export function getPluginAPI(): PluginApiManager {
  if (!pluginApi) {
    pluginApi = new PluginApiManager();
  }

  return pluginApi as PluginApiManager;
}

export async function loadPlugins() {
  for (const plugin of config.array("plugins")) {
    await getPluginAPI().loadPlugin(plugin);
  }
}
