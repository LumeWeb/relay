// @ts-ignore
import sodium from "sodium-universal";
import { getPluginAPI } from "../../plugin";

export default class Crypto {
  createHash(data: string): Buffer {
    const b4a = getPluginAPI().util.bufferEncoding;
    const buffer = b4a.from(data);
    let hash = b4a.allocUnsafe(32) as Buffer;
    sodium.crypto_generichash(hash, buffer);

    return hash;
  }
}
