import * as tls from "tls";
import b4a from "b4a";
import log from "../log.js";
import config from "../config.js";

export type SSLManagerRenewHandler = (domain: string) => Promise<boolean>;

export class SSLManager {
  private _context?: tls.SecureContext;
  private _key?: Buffer;
  private _cert?: Buffer;
  private _domain: string;
  private _renewHandler?: SSLManagerRenewHandler;

  constructor(domain: string) {
    this._domain = domain;
  }

  get context(): tls.SecureContext {
    return this._context as tls.SecureContext;
  }

  set privateKey(key: Buffer) {
    this._key = key;
    this._maybeUpdateContext();
  }

  set cert(cert: Buffer) {
    this._cert = cert;
    this._maybeUpdateContext();
  }

  private _maybeUpdateContext() {
    if (b4a.isBuffer(this._cert) && b4a.isBuffer(this._key)) {
      this._context = tls.createSecureContext({
        cert: this._cert,
        key: this._key,
      });
    }
  }

  public async renew(): Promise<boolean> {
    let result = false;

    try {
      result = (await this._renewHandler?.(this._domain)) as boolean;
    } catch (e) {
      log.error((e as Error).message);
    }
    return result;
  }

  get enabled() {
    return config.bool("ssl") && this._renewHandler;
  }
}

let sslManager: SSLManager;

export function get(): SSLManager {
  if (!sslManager) {
    sslManager = new SSLManager(config.get("domain"));
  }

  return sslManager;
}
