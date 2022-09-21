//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import BConfig from "bcfg";
import * as os from "os";

import path from "path";
import { errorExit } from "./lib/error.js";

const config = new BConfig("lumeweb-relay");

let configLocation;
let configDir;
const configFile = "config.conf";

switch (os.platform()) {
  case "win32":
    configDir = path.dirname(require?.main?.filename as string);
    configLocation = path.resolve(configDir, configFile);
    break;

  case "linux":
  default:
    configDir = "/etc/lumeweb/relay";
    configLocation = path.join(configDir, configFile);
    break;
}

config.inject({
  port: 8080,
  config: configLocation,
  logLevel: "info",
  pluginDir: path.join(configDir, "plugins"),
  plugins: ["core"],
  ssl: true,
});

config.load({
  env: true,
  argv: true,
});
try {
  config.open(configLocation);
} catch (e) {
  console.error((e as Error).message);
}

for (const setting of ["domain", "afraid-username", "seed"]) {
  if (!config.get(setting)) {
    errorExit(`Required config option ${setting} not set`);
  }
}

let usingPocketGateway = true;

export function usePocketGateway() {
  return usingPocketGateway;
}

export function updateUsePocketGateway(state: boolean): void {
  usingPocketGateway = state;
}

export default config;
