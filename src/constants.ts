import * as CONFIG from "./constant_vars.js";

let error = false;

for (const constant in CONFIG) {
  // @ts-ignore
  if (CONFIG[constant] === null || CONFIG[constant] === undefined) {
    console.error(`Missing constant ${constant}`);
    error = true;
  }
}

if (error) {
  process.exit(1);
}

let usingPocketGateway = true;

export function usePocketGateway() {
  return usingPocketGateway;
}

export function updateUsePocketGateway(state: boolean): void {
  usingPocketGateway = state;
}

export * from "./constant_vars.js";
