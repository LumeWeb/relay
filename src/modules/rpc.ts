//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import config from "../config.js";
import { errorExit } from "../lib/error.js";
// @ts-ignore
import stringify from "json-stable-stringify";
import { getRpcServer } from "../rpc/server.js";

export async function start() {
  if (!config.str("pocket-app-id") || !config.str("pocket-app-key")) {
    errorExit("Please set pocket-app-id and pocket-app-key config options.");
  }

  getRpcServer();
}
