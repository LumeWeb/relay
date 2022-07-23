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

let sslCtx: tls.SecureContext = tls.createSecureContext();
const sslParams: tls.SecureContextOptions = { cert: "", key: "" };

const sslPrivateKey = await acme.forge.createPrivateKey();
const acmeClient = new acme.Client({
  accountKey: sslPrivateKey,
  directoryUrl: isSSlStaging()
    ? acme.directory.letsencrypt.staging
    : acme.directory.letsencrypt.production,
});

let app: Express;
let router = express.Router();

const FILE_CERT_NAME = "/lumeweb/relay/ssl.crt";
const FILE_KEY_NAME = "/lumeweb/relay/ssl.key";

type SslData = { crt: IndependentFileSmall; key: IndependentFileSmall };

export async function start() {
  const relayPort = config.str("port");
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

  cron.schedule("0 * * * *", setupSSl);

  await new Promise((resolve) => {
    httpServer.listen(80, "0.0.0.0", function () {
      console.info("HTTP Listening on ", httpServer.address());
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
      console.info("Relay started on ", httpsServer.address());
      resolve(null);
    });
  });

  await setupSSl();
}

async function setupSSl() {
  let sslCert = await getSslCert();
  let sslKey = await getSslKey();
  let certInfo;
  let exists = false;
  let domainValid = false;
  let dateValid = false;

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

    if (certInfo?.domains.commonName === config.str("domain")) {
      domainValid = true;
    }
  }

  if (dateValid && domainValid) {
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
