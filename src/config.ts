// @ts-ignore
import Config from "@lumeweb/cfg";
import * as os from "os";
import * as fs from "fs";
import path from "path";
import log from "loglevel";
import chalk, { Chalk } from "chalk";
import prefix from "loglevel-plugin-prefix";

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

const colors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
} as { [level: string]: Chalk };

prefix.reg(log);
log.enableAll();

prefix.apply(log, {
  format(level, name, timestamp) {
    return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](
      level
    )} ${chalk.green(`${name}:`)}`;
  },
});

export default config;
