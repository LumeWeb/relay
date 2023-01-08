import Crypto from "./util/crypto";
import b4a from "b4a";
// @ts-ignore
import c from "compact-encoding";

export default class Util {
  private _crypto: Crypto = new Crypto();

  get crypto(): Crypto {
    return this._crypto;
  }
  get bufferEncoding(): typeof b4a {
    return b4a;
  }

  get binaryEncoding(): typeof c {
    return c;
  }
}
