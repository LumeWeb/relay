import { HDKey } from "micro-ed25519-hdkey";
import config from "../config";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { errorExit } from "./error.js";

export function getSeed() {
  const seed = config.str("seed");

  let valid = bip39.validateMnemonic(seed, wordlist);
  if (!valid) {
    errorExit("LUME_WEB_RELAY_SEED is invalid. Aborting.");
  }

  return bip39.mnemonicToSeedSync(seed);
}

export function getHDKey(): HDKey {
  return HDKey.fromMasterSeed(getSeed()).derive("m/44'/1627'/0'/0'/0'");
}

export function getKeyPair() {
  const key = getHDKey();

  return { publicKey: key.publicKeyRaw, secretKey: key.privateKey };
}
