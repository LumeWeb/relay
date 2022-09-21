//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import Config from "@lumeweb/cfg";
import * as os from "os";
import * as fs from "fs";
import path from "path";
import { errorExit } from "./lib/error.js";

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
  port: 8080,
  logLevel: "info",
  pluginDir: path.join(configDir, "plugins"),
  plugins: ["core"],
  ssl: true,
});

config.load({
  env: true,
  argv: true,
});
if (fs.existsSync(configDir)) {
  try {
    config.openDir(configDir);
  } catch (e) {
    console.error((e as Error).message);
  }
}

for (const setting of ["domain", "seed"]) {
  if (!config.get(setting)) {
    errorExit(`Required config option ${setting} not set`);
  }
}

export default config;
