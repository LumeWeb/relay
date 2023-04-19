import * as tls from "tls";
import b4a from "b4a";
import log from "../log.js";
import config from "../config.js";

export type SSLManagerRenewHandler = (domain: string) => Promise<boolean>;
type SSLCert = string | Buffer | Array<string | Buffer>;

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

  private _cert?: SSLCert;

  set cert(cert: SSLCert) {
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
    const valid = (value: any) =>
      b4a.isBuffer(value) || typeof value === "string" || Array.isArray(value);

    if (valid(this._cert) && valid(this._key)) {
      const opts: tls.SecureContextOptions = {
        key: this._key,
      };

      if (Array.isArray(this._cert)) {
        opts.ca = this._cert.slice(1);
        opts.cert = this._cert[0];
      } else {
        opts.cert = this._cert;
      }
      this._context = tls.createSecureContext(opts);
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
