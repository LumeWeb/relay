import tls from "tls";
import {
  createIndependentFileSmall,
  openIndependentFileSmall,
  overwriteIndependentFileSmall,
} from "./file.js";
// @ts-ignore
import promiseRetry from "promise-retry";
import config from "./config.js";
import log from "loglevel";
import { getSeed } from "./util.js";
import type {
  IndependentFileSmall,
  SavedSslData,
  SslData,
} from "@lumeweb/relay-types";

let sslCtx: tls.SecureContext = tls.createSecureContext();
let sslObject: SslData = {};
let sslChecker: () => Promise<void>;

const FILE_CERT_NAME = "/lumeweb/relay/ssl.crt";
const FILE_KEY_NAME = "/lumeweb/relay/ssl.key";

export function setSslContext(context: tls.SecureContext) {
  sslCtx = context;
}

export function getSslContext(): tls.SecureContext {
  return sslCtx;
}

export function setSsl(
  cert: IndependentFileSmall | Uint8Array,
  key: IndependentFileSmall | Uint8Array
): void {
  cert = (cert as IndependentFileSmall)?.fileData || cert;
  key = (key as IndependentFileSmall)?.fileData || cert;
  sslObject.cert = cert as Uint8Array;
  sslObject.key = key as Uint8Array;
  setSslContext(
    tls.createSecureContext({
      cert: Buffer.from(cert),
      key: Buffer.from(key),
    })
  );
}

export function getSsl(): SslData {
  return sslObject;
}

export async function saveSSl(): Promise<void> {
  const seed = getSeed();

  log.info(`Saving SSL Certificate for ${config.str("domain")}`);

  let oldCert = await getSslCert();
  let cert: any = getSsl()?.cert;
  cert = cert?.fileData;
  if (oldCert) {
    await overwriteIndependentFileSmall(
      oldCert as IndependentFileSmall,
      Buffer.from(cert)
    );
  } else {
    await createIndependentFileSmall(seed, FILE_CERT_NAME, Buffer.from(cert));
  }

  let oldKey = await getSslKey();
  let key: any = getSsl()?.cert;
  key = key?.fileData;

  if (oldKey) {
    await overwriteIndependentFileSmall(
      oldKey as IndependentFileSmall,
      Buffer.from(key)
    );
  } else {
    await createIndependentFileSmall(seed, FILE_KEY_NAME, Buffer.from(key));
  }
}

export async function getSavedSsl(
  retry = true
): Promise<boolean | SavedSslData> {
  let retryOptions = retry ? {} : { retries: 0 };
  let sslCert: IndependentFileSmall | boolean = false;
  let sslKey: IndependentFileSmall | boolean = false;

  try {
    await promiseRetry(async (retry: any) => {
      sslCert = await getSslCert();
      if (!sslCert) {
        retry();
      }
    }, retryOptions);

    await promiseRetry(async (retry: any) => {
      sslKey = await getSslKey();
      if (!sslKey) {
        retry();
      }
    }, retryOptions);
  } catch {}

  if (!sslCert || !sslKey) {
    return false;
  }

  return {
    cert: sslCert as IndependentFileSmall,
    key: sslKey as IndependentFileSmall,
  };
}

async function getSslCert(): Promise<IndependentFileSmall | boolean> {
  return getSslFile(FILE_CERT_NAME);
}

async function getSslKey(): Promise<IndependentFileSmall | boolean> {
  return getSslFile(FILE_KEY_NAME);
}

async function getSslFile(
  name: string
): Promise<IndependentFileSmall | boolean> {
  let seed = getSeed();

  let [file, err] = await openIndependentFileSmall(seed, name);

  if (err) {
    return false;
  }

  return file;
}

export function setSSlCheck(checker: () => Promise<void>): void {
  sslChecker = checker;
}

export function getSslCheck(): () => Promise<void> {
  return sslChecker;
}
