import config from "../config.js";
import type { RPCServer } from "./rpc/server.js";
import { getRpcServer } from "./rpc/server.js";
import type { Plugin, RPCMethod } from "@lumeweb/relay-types";
import slugify from "slugify";
import * as fs from "fs";
import path from "path";
import type { Logger } from "pino";

import { getSeed } from "../lib/seed.js";
import pluginRpc from "./plugins/rpc";
import pluginCore from "./plugins/core";
import type Config from "@lumeweb/cfg";
import EventEmitter2 from "eventemitter2";
import log from "../log.js";
import { get as getSwarm } from "./swarm.js";

let pluginAPIManager: PluginAPIManager;
let pluginAPI: PluginAPI;

const sanitizeName = (name: string) =>
  slugify(name, { lower: true, strict: true });

class PluginAPI extends EventEmitter2 {
  private _server: RPCServer;

  constructor({
    config,
    logger,
    server,
    swarm,
  }: {
    config: Config;
    logger: Logger;
    server: RPCServer;
    swarm: any;
  }) {
    super({
      wildcard: true,
      verboseMemoryLeak: true,
      maxListeners: 0,
    });
    this._config = config;
    this._logger = logger;
    this._server = server;
    this._swarm = swarm;
  }

  private _swarm: any;

  get swarm(): any {
    return this._swarm;
  }

  private _config: Config;

  get config(): Config {
    return this._config;
  }

  private _logger: Logger;

  get logger(): Logger {
    return this._logger;
  }

  get rpcServer(): RPCServer {
    return this._server;
  }

  get seed(): Uint8Array {
    return getSeed();
  }

  public loadPlugin(
    moduleName: string
  ): (moduleName: string) => Promise<Plugin> {
    return getPluginAPIManager().loadPlugin;
  }

  registerMethod(methodName: string, method: RPCMethod): void {
    throw new Error("not implemented and should not be called");
  }
}

export function getPluginAPI(): PluginAPI {
  if (!pluginAPI) {
    pluginAPI = new PluginAPI({
      config,
      logger: log,
      server: getRpcServer(),
      swarm: getSwarm(),
    });
  }

  return pluginAPI as PluginAPI;
}

export class PluginAPIManager {
  private registeredPlugins: Map<string, Plugin> = new Map<string, Plugin>();

  public async loadPlugin(moduleName: string): Promise<Plugin> {
    moduleName = sanitizeName(moduleName);

    if (this.registeredPlugins.has(moduleName)) {
      return this.registeredPlugins.get(moduleName) as Plugin;
    }

    const paths = [];
    for (const modulePath of [`${moduleName}.js`, `${moduleName}.mjs`]) {
      const fullPath = path.join(config.get("plugindir"), modulePath);
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
      plugin = require(paths.shift() as string) as Plugin;
    } catch (e) {
      throw e;
    }

    return this.loadPluginInstance(plugin);
  }

  public async loadPluginInstance(plugin: Plugin): Promise<Plugin> {
    if ("default" in plugin) {
      plugin = plugin?.default as Plugin;
    }

    plugin.name = sanitizeName(plugin.name);

    this.registeredPlugins.set(plugin.name, plugin);

    try {
      plugin.plugin(
        // @ts-ignore
        new Proxy<PluginAPI>(getPluginAPI(), {
          get(target: PluginAPI, prop: string): any {
            if (prop === "registerMethod") {
              return (methodName: string, method: RPCMethod): void => {
                return getRpcServer().registerMethod(
                  plugin.name,
                  methodName,
                  method
                );
              };
            }

            return (target as any)[prop];
          },
        })
      );
    } catch (e) {
      throw e;
    }

    return plugin;
  }
}

export function getPluginAPIManager(): PluginAPIManager {
  if (!pluginAPIManager) {
    pluginAPIManager = new PluginAPIManager();
  }

  return pluginAPIManager as PluginAPIManager;
}

export async function loadPlugins() {
  const apiManager = getPluginAPIManager();

  apiManager.loadPluginInstance(pluginCore);
  apiManager.loadPluginInstance(pluginRpc);

  for (const plugin of [...new Set(config.array("plugins", []))] as []) {
    await apiManager.loadPlugin(plugin);
  }

  getPluginAPI().emit("core.pluginsLoaded");
}
