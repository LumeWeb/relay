import WS from "ws";

// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { get as getDHT } from "./dht.js";
// @ts-ignore
import GLE from "greenlock-express";
// @ts-ignore
import Greenlock from "@root/greenlock";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sslConfig = {
  packageRoot: path.dirname(__dirname),
  configDir: path.resolve(__dirname, "../", "./data/greenlock.d/"),
  cluster: false,
  agreeToTerms: true,
  staging: true,
};

export async function start() {
  const relayDomain = config.str("relay-domain");
  const relayPort = config.str("relay-port");
  const greenlock = Greenlock.create(sslConfig);
  await greenlock.add({
    subject: relayDomain,
    altnames: [relayDomain],
  });
  // @ts-ignore
  config.greenlock = greenlock;
  GLE.init(sslConfig).ready(async (GLEServer: any) => {
    let httpsServer = GLEServer.httpsServer();
    var httpServer = GLEServer.httpServer();

    await new Promise((resolve) => {
      httpServer.listen(80, "0.0.0.0", function () {
        console.info("HTTP Listening on ", httpServer.address());
        resolve(null);
      });
    });

    const dht = await getDHT();

    let wsServer = new WS.Server({ server: httpServer });

    wsServer.on("connection", (socket: any) => {
      relay(dht, new Stream(false, socket));
    });
    await new Promise((resolve) => {
      httpsServer.listen(relayPort, "0.0.0.0", function () {
        console.info("Relay started on ", httpsServer.address());
        resolve(null);
      });
    });

    await greenlock.get({
      servername: relayDomain,
    });
  });
}
