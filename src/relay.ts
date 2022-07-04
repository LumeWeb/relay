import WS from "ws";

// @ts-ignore
import DHT from "@hyperswarm/dht";
// @ts-ignore
import { relay } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { get as getDHT } from "./dht.js";
import { RELAY_DOMAIN, RELAY_PORT } from "./constants.js";
// @ts-ignore
import GLE from "greenlock-express";
// @ts-ignore
import Greenlock from "@root/greenlock";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  packageRoot: path.dirname(__dirname),
  configDir: path.resolve(__dirname, "../", "./data/greenlock.d/"),
  cluster: false,
  agreeToTerms: true,
  staging: true,
};

export async function start() {
  const greenlock = Greenlock.create(config);
  await greenlock.add({
    subject: RELAY_DOMAIN,
    altnames: [RELAY_DOMAIN],
  });
  // @ts-ignore
  config.greenlock = greenlock;
  GLE.init(config).ready(async (GLEServer: any) => {
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
      httpsServer.listen(RELAY_PORT, "0.0.0.0", function () {
        console.info("Relay started on ", httpsServer.address());
        resolve(null);
      });
    });

    await greenlock.get({
      servername: RELAY_DOMAIN,
    });
  });
}
