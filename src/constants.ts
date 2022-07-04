import * as CONFIG from "./constant_vars.js";

let error = false;

for (const constant in CONFIG) {
  // @ts-ignore
  if (!CONFIG[constant]) {
    console.error(`Missing constant ${constant}`);
    error = true;
  }
}

if (error) {
  process.exit(1);
}

export * from "./constant_vars.js";
