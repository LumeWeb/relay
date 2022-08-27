//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import { start as startDns } from "./dns.js";
import config from "./config.js";
import { errorExit } from "./error.js";
// @ts-ignore
import stringify from "json-stable-stringify";
import { getRpcServer } from "./rpc/server.js";

export async function start() {
  if (!config.str("pocket-app-id") || !config.str("pocket-app-key")) {
    errorExit("Please set pocket-app-id and pocket-app-key config options.");
  }

  getRpcServer();
  await startDns();
}
