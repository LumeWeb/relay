import { HDKey } from "ed25519-keygen/hdkey";
import config from "../config";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { errorExit } from "./error.js";
import b4a from "b4a";

const BIP44_PATH = "m/44'/1627'/0'/0'/0'";

export function getSeed() {
  const seed = config.str("core.seed") as string;

  let valid = bip39.validateMnemonic(seed, wordlist);
  if (!valid) {
    errorExit("LUME_WEB_RELAY_SEED is invalid. Aborting.");
  }

  return bip39.mnemonicToSeedSync(seed);
}

export function getHDKey(): HDKey {
  return HDKey.fromMasterSeed(getSeed()).derive(BIP44_PATH);
}

export function getKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const key = getHDKey();

  return {
    publicKey: key.publicKeyRaw,
    secretKey: b4a.concat([key.privateKey, key.publicKeyRaw]),
  };
}
