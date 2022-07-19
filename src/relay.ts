// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import {relay} from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import express, {Express} from "express";
import path from "path";
import {fileURLToPath} from "url";
import config from "./config.js";
import * as http from "http";
import * as https from "https";
import * as tls from "tls";
import * as acme from "acme-client";
import {Buffer} from "buffer";
import {intervalToDuration} from "date-fns";
import cron from "node-cron";
import {get as getDHT} from "./dht.js";
import WS from "ws";
// @ts-ignore
import DHT from "@hyperswarm/dht";
import {pack} from "msgpackr";
import {overwriteRegistryEntry} from "libskynetnode";
import {hashDataKey} from "./util.js";

let sslCtx: tls.SecureContext = tls.createSecureContext();
const sslParams: tls.SecureContextOptions = {};

const sslPrivateKey = await acme.forge.createPrivateKey();
const acmeClient = new acme.Client({
    accountKey: sslPrivateKey,
    directoryUrl: acme.directory.letsencrypt.production,
});

let app: Express;
let router = express.Router();

export async function start() {
    const relayPort = config.str("relay-port");
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

    cron.schedule("0 * * * *", createOrRenewSSl);

    await new Promise((resolve) => {
        httpServer.listen(80, "0.0.0.0", function () {
            console.info("HTTP Listening on ", httpServer.address());
            resolve(null);
        });
    });
    const dht = await getDHT();

    let wsServer = new WS.Server({server: httpsServer});

    wsServer.on("connection", (socket: any) => {
        relay(dht, new Stream(false, socket));
    });

    await new Promise((resolve) => {
        httpsServer.listen(relayPort, "0.0.0.0", function () {
            console.info("Relay started on ", httpsServer.address());
            resolve(null);
        });
    });

    await createOrRenewSSl();
}

async function createOrRenewSSl() {
    if (sslParams.cert) {
        const expires = (
            await acme.forge.readCertificateInfo(sslParams.cert as Buffer)
        ).notAfter;

        let duration = intervalToDuration({start: new Date(), end: expires});

        let daysLeft = (duration.months as number) * 30 + (duration.days as number);

        if (daysLeft > 30) {
            return;
        }
    }

    const [certificateKey, certificateRequest] = await acme.forge.createCsr({
        commonName: config.str("relay-domain"),
    });

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
    sslParams.key = certificateKey;
    sslCtx = tls.createSecureContext(sslParams);

    console.log("SSL Certificate Updated");
}
