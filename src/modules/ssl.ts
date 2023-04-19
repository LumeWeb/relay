import * as tls from "tls";
import b4a from "b4a";
import log from "../log.js";
import config from "../config.js";

export type SSLManagerRenewHandler = (domain: string) => Promise<boolean>;

export class SSLManager {
  private _key?: Buffer;
  private _domain: string;

  constructor(domain: string) {
    this._domain = domain;
  }

  private _context?: tls.SecureContext;

  get context(): tls.SecureContext {
    return this._context as tls.SecureContext;
  }

  private _cert?: Buffer;

  set cert(cert: Buffer) {
    this._cert = cert;
    this._maybeUpdateContext();
  }

  private _renewHandler?: SSLManagerRenewHandler;

  get renewHandler(): SSLManagerRenewHandler {
    return this._renewHandler as any;
  }

  set renewHandler(value: SSLManagerRenewHandler) {
    this._renewHandler = value;
  }

  set privateKey(key: Buffer) {
    this._key = key;
    this._maybeUpdateContext();
  }

  get enabled() {
    return config.bool("core.ssl");
  }

  get ready() {
    return this.enabled && this.renewHandler;
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

  private _maybeUpdateContext() {
    if (b4a.isBuffer(this._cert) && b4a.isBuffer(this._key)) {
      this._context = tls.createSecureContext({
        cert: this._cert,
        key: this._key,
      });
    }
  }
}

let sslManager: SSLManager;

export function get(): SSLManager {
  if (!sslManager) {
    sslManager = new SSLManager(config.get("core.domain"));
  }

  return sslManager;
}
