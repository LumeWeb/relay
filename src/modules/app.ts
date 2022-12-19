import { AddressInfo } from "net";
import log from "../log.js";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { getKeyPair } from "../lib/seed.js";

let app: FastifyInstance;

export async function start() {
  const keyPair = getKeyPair();
  app = fastify({
    logger: true,
  });

  app.get("/", (req, res) => {
    res.send(Buffer.from(keyPair.publicKey).toString("hex"));
  });

  await app.listen({ port: 80, host: "0.0.0.0" });

  const address = app.server.address() as AddressInfo;

  log.info("HTTP/App Server started on ", `${address.address}:${address.port}`);
}
