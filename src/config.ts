// @ts-ignore
import BConfig from "bcfg";
import { errorExit } from "./util.js";

const config = new BConfig("lumeweb-relay");

config.inject({
  relayPort: 8080,
});

config.load({
  env: true,
  argv: true,
});
try {
  config.open("config.conf");
} catch (e) {}

for (const setting of ["relay-domain", "afraid-username", "relay-seed"]) {
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
