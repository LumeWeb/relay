// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import express, { Express } from "express";
import config from "./config.js";
import * as http from "http";
import * as https from "https";
import * as tls from "tls";
import * as acme from "acme-client";
import { Buffer } from "buffer";
import { intervalToDuration } from "date-fns";
import cron from "node-cron";
import { get as getDHT } from "./dht.js";
import WS from "ws";
// @ts-ignore
import {
  createIndependentFileSmall,
  IndependentFileSmall,
  openIndependentFileSmall,
  overwriteIndependentFileSmall,
} from "./file.js";
import { seedPhraseToSeed } from "libskynet";
import log from "loglevel";
import { AddressInfo } from "net";
import { sprintf } from "sprintf-js";

let sslCtx: tls.SecureContext = tls.createSecureContext();
const sslParams: tls.SecureContextOptions = { cert: "", key: "" };

let acmeClient: acme.Client;

let app: Express;
let router = express.Router();

const FILE_CERT_NAME = "/lumeweb/relay/ssl.crt";
const FILE_KEY_NAME = "/lumeweb/relay/ssl.key";
const FILE_ACCOUNT_KEY_NAME = "/lumeweb/relay/account.key";

type SslData = { crt: IndependentFileSmall; key: IndependentFileSmall };

export async function start() {
  const relayPort = config.uint("port");
  app = express();
  app.use(function (req, res, next) {
    router(req, res, next);
  });

  let httpsServer = https.createServer({
    SNICallback(servername, cb) {
      cb(null, sslCtx);
    },
  });

  let httpServer = http.createServer(app);

  cron.schedule("0 * * * *", setupSSl.bind(null, false));

  await new Promise((resolve) => {
    httpServer.listen(80, "0.0.0.0", function () {
      const address = httpServer.address() as AddressInfo;
      log.info("HTTP Server started on ", `${address.address}:${address.port}`);
      resolve(null);
    });
  });
  const dht = await getDHT();

  let wsServer = new WS.Server({ server: httpsServer });

  wsServer.on("connection", (socket: any) => {
    relay(dht, new Stream(false, socket));
  });

  await new Promise((resolve) => {
    httpsServer.listen(relayPort, "0.0.0.0", function () {
      const address = httpsServer.address() as AddressInfo;
      log.info(
        "DHT Relay Server started on ",
        `${address.address}:${address.port}`
      );
      resolve(null);
    });
  });

  await setupSSl(true);
}

async function setupSSl(bootup: boolean) {
  let sslCert = await getSslCert();
  let sslKey = await getSslKey();
  let certInfo;
  let exists = false;
  let domainValid = false;
  let dateValid = false;
  let configDomain = config.str("domain");

  if (sslCert && sslKey) {
    sslParams.cert = Buffer.from((sslCert as IndependentFileSmall).fileData);
    sslParams.key = Buffer.from((sslKey as IndependentFileSmall).fileData);
    certInfo = await getCertInfo();
    exists = true;
  }

  if (exists) {
    const expires = certInfo?.notAfter as Date;
    let duration = intervalToDuration({ start: new Date(), end: expires });
    let daysLeft = (duration.months as number) * 30 + (duration.days as number);

    if (daysLeft > 30) {
      dateValid = true;
    }

    if (certInfo?.domains.commonName === configDomain) {
      domainValid = true;
    }

    if (
      Boolean(isSSlStaging()) !==
      Boolean(certInfo?.issuer.commonName.toLowerCase().includes("staging"))
    ) {
      domainValid = false;
    }
  }

  if (dateValid && domainValid) {
    if (bootup) {
      sslCtx = tls.createSecureContext(sslParams);
      log.info(`Loaded SSL Certificate for ${configDomain}`);
    }
    return;
  }

  await createOrRenewSSl(
    sslCert as IndependentFileSmall,
    sslKey as IndependentFileSmall
  );
}

async function createOrRenewSSl(
  oldCert?: IndependentFileSmall,
  oldKey?: IndependentFileSmall
) {
  const existing = oldCert && oldKey;

  log.info(
    sprintf(
      "%s SSL Certificate for %s",
      existing ? "Renewing" : "Creating",
      config.str("domain")
    )
  );

  let accountKey: boolean | IndependentFileSmall | Buffer = await getSslFile(
    FILE_ACCOUNT_KEY_NAME
  );

  if (accountKey) {
    accountKey = Buffer.from((accountKey as IndependentFileSmall).fileData);
  }

  if (!accountKey) {
    accountKey = await acme.forge.createPrivateKey();
    await createIndependentFileSmall(
      getSeed(),
      FILE_ACCOUNT_KEY_NAME,
      accountKey
    );
  }

  acmeClient = new acme.Client({
    accountKey: accountKey as Buffer,
    directoryUrl: isSSlStaging()
      ? acme.directory.letsencrypt.staging
      : acme.directory.letsencrypt.production,
  });

  const [certificateKey, certificateRequest] = await acme.forge.createCsr({
    commonName: config.str("domain"),
  });
  try {
    sslParams.cert = await acmeClient.auto({
      csr: certificateRequest,
      termsOfServiceAgreed: true,
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        router.get(
          `/.well-known/acme-challenge/${challenge.token}`,
          (req, res) => {
            res.send(keyAuthorization);
          }
        );
      },
      challengeRemoveFn: async () => {
        router = express.Router();
      },
      challengePriority: ["http-01"],
    });
    sslParams.cert = Buffer.from(sslParams.cert);
  } catch (e: any) {
    console.error((e as Error).message);
    process.exit(1);
  }
  sslParams.key = certificateKey;
  sslCtx = tls.createSecureContext(sslParams);

  await saveSsl(oldCert, oldKey);
}

async function saveSsl(
  oldCert?: IndependentFileSmall,
  oldKey?: IndependentFileSmall
): Promise<void> {
  const seed = getSeed();

  log.info(`Saving SSL Certificate for ${config.str("domain")}`);

  if (oldCert) {
    await overwriteIndependentFileSmall(
      oldCert,
      Buffer.from(sslParams.cert as any)
    );
  } else {
    await createIndependentFileSmall(
      seed,
      FILE_CERT_NAME,
      Buffer.from(sslParams.cert as any)
    );
  }

  if (oldKey) {
    await overwriteIndependentFileSmall(
      oldKey,
      Buffer.from(sslParams.key as any)
    );
  } else {
    await createIndependentFileSmall(
      seed,
      FILE_KEY_NAME,
      Buffer.from(sslParams.key as any)
    );
  }
}

async function getCertInfo() {
  return acme.forge.readCertificateInfo(sslParams.cert as Buffer);
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

function getSeed(): Uint8Array {
  let [seed, err] = seedPhraseToSeed(config.str("seed"));

  if (err) {
    console.error(err);
    process.exit(1);
  }

  return seed;
}

function isSSlStaging() {
  return config.str("ssl-mode") === "staging";
}
