// @ts-ignore
import Config from "@lumeweb/cfg";
import * as os from "os";
import * as fs from "fs";
import path from "path";
import log from "loglevel";

const config = new Config("lumeweb-relay");

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
    configDir = "/etc/lumeweb/relay/config.d";
    break;
}

config.inject({
  configDir,
  port: 8080,
  logLevel: "info",
  pluginDir: path.resolve(configDir, "..", "plugins"),
  plugins: ["core"],
  ssl: false,
});

config.load({
  env: true,
  argv: true,
});

configDir = config.str("configdir");

if (fs.existsSync(configDir)) {
  try {
    config.openDir(configDir);
  } catch (e) {
    console.error((e as Error).message);
  }
}

config.load({
  env: true,
  argv: true,
});

log.setDefaultLevel(config.get("loglevel"));

export default config;
