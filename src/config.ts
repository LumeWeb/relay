// @ts-ignore
import { Config } from "@lumeweb/relay-cfg";
import * as os from "os";
import * as fs from "fs";
import path from "path";
import log from "./log.js";

const config = new Config("lumeweb-relay", "core.confDir");

let configDir;

switch (os.platform()) {
  case "win32":
    configDir = path.join(
      path.dirname(require?.main?.filename as string),
      "config"
    );
    break;

  case "linux":
  default:
    configDir = "/etc/lumeweb/relay/conf.d";
    break;
}

config.inject({
  "core.confDir": configDir,
  "core.port": 8080,
  "core.relayPort": 0,
  "core.appPort": 80,
  "core.logLevel": "info",
  "core.pluginDir": path.resolve(configDir, "..", "plugins"),
});

config.load();

configDir = config.str("core.confDir") as string;

if (fs.existsSync(configDir)) {
  try {
    config.openDir(configDir);
  } catch (e) {
    console.error((e as Error).message);
  }
}

config.load();

log.level = config.get("core.loglevel");

export default config;
