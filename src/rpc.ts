import crypto from "crypto";
import jayson from "jayson/promise/index.js";
import { pack, unpack } from "msgpackr";
import { Mutex } from "async-mutex";
import { createRequire } from "module";
import NodeCache from "node-cache";
import { get as getDHT } from "./dht.js";
import { rpcMethods } from "./rpc/index.js";
import PocketPKG from "@pokt-network/pocket-js";

const { Configuration, HttpRpcProvider, PocketAAT, Pocket } = PocketPKG;
import {
  JSONRPCError,
  JSONRPCRequest,
  JSONRPCResponseWithError,
  JSONRPCResponseWithResult,
} from "jayson";
import config, { updateUsePocketGateway, usePocketGateway } from "./config.js";
import { ERR_NOT_READY, errorExit } from "./error.js";

const require = createRequire(import.meta.url);

const stringify = require("json-stable-stringify");
const pendingRequests = new NodeCache();
const processedRequests = new NodeCache({
  stdTTL: 60 * 60 * 12,
});

type PocketAATObject = typeof PocketAAT;

let pocketServer: typeof Pocket;
let _aat: PocketAATObject;
let jsonServer: jayson.Server;

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
    rpcResp = await processRpcRequest(
      {
        method: request.query,
        jsonrpc: "2.0",
        params: request.data,
        id: 1,
      } as unknown as JSONRPCRequest,
      request.chain
    );
  } catch (e) {
    error = (e as Error).message;
  }

  let dbData: RPCResponse = {
    updated: Date.now(),
    data: "",
  };

  if (rpcResp) {
    rpcResp = rpcResp as JSONRPCResponseWithResult;
    if (false === rpcResp.result) {
      error = true;
    }

    rpcResp = rpcResp as unknown as JSONRPCResponseWithError;

    if (rpcResp.error) {
      // @ts-ignore
      error = rpcResp.error.message;
    }
  }

  dbData.data = error
    ? { error }
    : (rpcResp as unknown as JSONRPCResponseWithResult).result;

  if (!processedRequests.get(reqId) || request.force) {
    processedRequests.set(reqId, dbData);
  }

  await lock.release();

  return dbData;
}

export function updateAat(aat: PocketAATObject): void {
  _aat = aat;
}

export function getAat(): PocketAATObject {
  return _aat;
}

export function getPocketServer(): typeof Pocket {
  return pocketServer;
}

export async function unlockAccount(
  accountPrivateKey: string,
  accountPublicKey: string,
  accountPassphrase: string
): Promise<PocketAATObject> {
  try {
    // @ts-ignore
    const account = await pocketServer.keybase.importAccount(
      Buffer.from(accountPrivateKey, "hex"),
      accountPassphrase
    );

    if (account instanceof Error) {
      // noinspection ExceptionCaughtLocallyJS
      throw account;
    }

    // @ts-ignore
    await pocketServer.keybase.unlockAccount(
      account.addressHex,
      accountPassphrase,
      0
    );

    // @ts-ignore
    return await PocketAAT.from(
      "0.0.1",
      accountPublicKey,
      accountPublicKey,
      accountPrivateKey
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

export async function processRpcRequest(
  request: JSONRPCRequest,
  chain: string
): Promise<JSONRPCResponseWithResult | JSONRPCResponseWithError | undefined> {
  return new Promise((resolve) => {
    jsonServer.call(
      request,
      { chain },
      (
        err?: JSONRPCResponseWithError | null,
        result?: JSONRPCResponseWithResult
      ): void => {
        if (err) {
          return resolve(err);
        }
        resolve(result);
      }
    );
  });
}

export async function start() {
  if (!config.str("pocket-app-id") || !config.str("pocket-app-key")) {
    const pocketHost = config.str("pocket-host");
    const pocketPort = config.uint("pocket-port");
    if (!pocketHost || !pocketPort) {
      errorExit(
        "Please set pocket-host and pocket-port config options if you do not have an API key set"
      );
    }

    const dispatchURL = new URL(
      `http://${config.str("pocket-host")}:${config.uint("pocket-port")}`
    );
    const rpcProvider = new HttpRpcProvider(dispatchURL);
    const configuration = new Configuration();
    // @ts-ignore
    pocketServer = new Pocket([dispatchURL], rpcProvider, configuration);
    updateUsePocketGateway(false);
  }

  if (!usePocketGateway()) {
    updateAat(
      await unlockAccount(
        <string>config.str("pocket-account-private-key"),
        <string>config.str("pocket-account-public-key"),
        "0"
      )
    );
  }

  jsonServer = new jayson.Server(rpcMethods, { useContext: true });

  (await getDHT("server")).on("connection", (socket: any) => {
    socket.rawStream._ondestroy = () => false;

    let isRpc = false;
    socket.once("data", async (data: any) => {
      if (data === "rpc") {
        isRpc = true;
      }
    });
    socket.once("data", async (data: any) => {
      if (!isRpc) {
        return;
      }
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
