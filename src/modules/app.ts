import { AddressInfo } from "net";
import log from "../log.js";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { getKeyPair } from "../lib/seed.js";
import config from "../config";

let app: FastifyInstance;

export async function start() {
  const keyPair = getKeyPair();
  app = fastify({
    logger: log.child({ module: "app-server" }),
  });

  app.get("/", (req, res) => {
    res.send(Buffer.from(keyPair.publicKey).toString("hex"));
  });

  await app.listen({ port: config.uint("core.appport"), host: "0.0.0.0" });
}
