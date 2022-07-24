//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

// @ts-ignore
import BConfig from "bcfg";
import * as os from "os";

import path from "path";
import { errorExit } from "./error.js";

const config = new BConfig("lumeweb-relay");

let configLocation;
const configFile = "config.conf";

switch (os.platform()) {
  case "win32":
    configLocation = path.resolve(
      require?.main?.filename as string,
      configFile
    );
    break;

  case "linux":
  default:
    configLocation = path.join("/etc/lumeweb/relay", configFile);
    break;
}

config.inject({
  relayPort: 8080,
  config: configLocation,
  logLevel: "info",
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
