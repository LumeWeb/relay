import config from "./config";

let seedPhraseToSeed: typeof import("libskynet").seedPhraseToSeed;

export async function loadUtilFunctions() {
  seedPhraseToSeed = (await dynImport("libskynet")).seedPhraseToSeed;
}

export function dynImport(module: string) {
  return Function(`return import("${module}")`)() as Promise<any>;
}

export function getSeed(): Uint8Array {
  let [seed, err] = seedPhraseToSeed(config.str("seed"));

  if (err) {
    console.error(err);
    process.exit(1);
  }

  return seed;
}
