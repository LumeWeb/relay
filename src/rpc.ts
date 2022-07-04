import crypto from "crypto";
import jayson from "jayson/promise/index.js";
import { pack, unpack } from "msgpackr";
import { Mutex } from "async-mutex";
import { createRequire } from "module";
import NodeCache from "node-cache";
import { get as getDHT } from "./dht.js";
const require = createRequire(import.meta.url);

const stringify = require("json-stable-stringify");

const clients: { [chain: string]: any } = {};
const pendingRequests = new NodeCache();
const processedRequests = new NodeCache({
  stdTTL: 60 * 60 * 12,
});

interface RPCRequest {
  force: boolean;
  chain: string;
  query: string;
  data: string;
}

interface RPCResponse {
  updated: number;
  data:
    | any
    | {
        error: string | boolean;
      };
}

function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getClient(chain: string): Function {
  chain = chain.replace(/[^a-z0-9\-]/g, "");

  if (!(chain in clients)) {
    clients[chain] = jayson.Client.http({
      host: process.env.RPC_PROXY_HOST,
      port: parseInt(process.env.RPC_PROXY_PORT as string),
      path: "/",
      headers: {
        "X-Chain": chain,
      },
    });
  }

  return clients[chain];
}

function getRequestId(request: RPCRequest) {
  const clonedRequest = Object.assign({}, request);

  // @ts-ignore
  delete clonedRequest.force;

  return hash(stringify(clonedRequest));
}

function maybeProcessRequest(request: RPCRequest) {
  if (!request.chain) {
    throw new Error("RPC chain missing");
  }

  if (!request.data) {
    throw new Error("RPC data missing");
  }

  return processRequest(request);
}

async function processRequest(request: RPCRequest): Promise<RPCResponse> {
  const reqId = getRequestId(request);

  let lock: Mutex = pendingRequests.get(reqId) as Mutex;
  const lockExists = !!lock;

  if (!lockExists) {
    lock = new Mutex();
    pendingRequests.set(reqId, lock);
  }

  if (lock.isLocked()) {
    await lock.waitForUnlock();
    return processedRequests.get(reqId) as RPCResponse;
  }
  await lock.acquire();

  if (!request.force && processedRequests.get(reqId)) {
    return processedRequests.get(reqId) as RPCResponse;
  }

  let rpcResp;

  let error;
  try {
    // @ts-ignore
    rpcResp = await getClient(request.chain).request(
      request.query,
      request.data
    );
  } catch (e) {
    error = (e as Error).message;
  }

  let dbData: RPCResponse = {
    updated: Date.now(),
    data: "",
  };

  if (rpcResp) {
    if (false === rpcResp.result) {
      error = true;
    }
    if (rpcResp.error) {
      error = rpcResp.error.message;
    }
  }

  dbData.data = error ? { error } : rpcResp.result;

  if (!processedRequests.get(reqId) || request.force) {
    processedRequests.set(reqId, dbData);
  }

  await lock.release();

  return dbData;
}

export async function start() {
  (await getDHT()).on("connection", (socket: any) => {
    socket.on("data", async (data: any) => {
      let request: RPCRequest;
      try {
        request = unpack(data) as RPCRequest;
      } catch (e) {
        return;
      }

      try {
        socket.write(pack(await maybeProcessRequest(request)));
      } catch (error) {
        console.trace(error);
        socket.write(pack({ error }));
      }
      socket.end();
    });
  });
}
