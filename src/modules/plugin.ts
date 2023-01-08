import config from "../config.js";
import type { RPCServer } from "./rpc/server.js";
import { getRpcServer } from "./rpc/server.js";
import type { Plugin, RPCMethod } from "@lumeweb/relay-types";
import slugify from "slugify";
import * as fs from "fs";
import path from "path";
import type { Logger } from "pino";

import { getHDKey, getSeed } from "../lib/seed.js";
import type Config from "@lumeweb/cfg";
import EventEmitter2 from "eventemitter2";
import log from "../log.js";
import {
  get as getSwarm,
  getProtocolManager,
  ProtocolManager,
} from "./swarm.js";
import { get as getSSl, SSLManager } from "./ssl.js";
import type { HDKey } from "micro-ed25519-hdkey";
import corePlugins from "../plugins";
import Util from "./plugin/util";

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

  private _util: Util = new Util();

  get util(): Util {
    return this._util;
  }

  private _swarm: any;

  get swarm(): any {
    return this._swarm;
  }

  private _config: Config;

  get config(): Config {
    return this._config;
  }

  get pluginConfig(): Config {
    throw new Error("not implemented and should not be called");
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

  get identity(): HDKey {
    return getHDKey();
  }

  get ssl(): SSLManager {
    return getSSl();
  }

  get protocols(): ProtocolManager {
    return getProtocolManager();
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

            if (prop === "pluginConfig") {
              return new Proxy<Config>(config, {
                get(target: Config, prop: string): any {
                  if (prop === "set") {
                    return (key: string, value: any): void => {
                      target.set(`plugin.${plugin.name}.${key}`, value);
                    };
                  }

                  if (prop === "get") {
                    return (key: string, fallback = null): any => {
                      return target.get(
                        `plugin.${plugin.name}.${key}`,
                        fallback
                      );
                    };
                  }

                  if (prop === "has") {
                    return (key: string): any => {
                      return target.has(`plugin.${plugin.name}.${key}`);
                    };
                  }

                  return (target as any)[prop];
                },
              });
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

  for (const plugin of corePlugins) {
    await apiManager.loadPluginInstance(plugin);
  }

  for (const plugin of [...new Set(config.array("plugins", []))] as []) {
    await apiManager.loadPlugin(plugin);
  }

  getPluginAPI().emit("core.pluginsLoaded");
}
