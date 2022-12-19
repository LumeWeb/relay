import log from "../log.js";

export function errorExit(msg: string): void {
  log.error(msg);
  process.exit(1);
}

export const ERR_NOT_READY = "NOT_READY";
export const ERR_INVALID_CHAIN = "INVALID_CHAIN";
export const ERR_ENDPOINT_INVALID = "ENDPOINT_INVALID";
export const ERR_METHOD_INVALID = "METHOD_INVALID";
export const ERR_HASH_IS_DIRECTORY = "HASH_IS_DIRECTORY";
