//const require = createRequire(import.meta.url);
//import { createRequire } from "module";

import crypto from "crypto";
import jayson from "jayson/promise/index.js";
import { pack, unpack } from "msgpackr";
import { Mutex } from "async-mutex";
import NodeCache from "node-cache";
import { get as getDHT } from "./dht.js";
import { rpcMethods } from "./rpc/index.js";
import { start as startDns } from "./dns.js";
import {
  Configuration,
  HttpRpcProvider,
  PocketAAT,
  Pocket,
} from "@pokt-network/pocket-js/dist/index.js";
import {
  JSONRPCError,
  JSONRPCRequest,
  JSONRPCResponseWithError,
  JSONRPCResponseWithResult,
} from "jayson";
import config, { updateUsePocketGateway, usePocketGateway } from "./config.js";
import { ERR_NOT_READY, errorExit } from "./error.js";
import log from "loglevel";
// @ts-ignore
import stringify from "json-stable-stringify";
import { getStream } from "./streams.js";
import type { StreamFileResponse } from "./streams.js";

const pendingRequests = new NodeCache();
const processedRequests = new NodeCache({
  stdTTL: 60 * 60 * 12,
});

type PocketAATObject = typeof PocketAAT;

let pocketServer: typeof Pocket;
let _aat: PocketAATObject;
let jsonServer: jayson.Server;

interface RPCRequest {
  bypassCache: boolean;
  chain: string;
  query: string;
  data: string;
}

interface RPCResponse {
  updated: number;
  data: any;
  error?: string;
}

function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getRequestId(request: RPCRequest) {
  const clonedRequest = Object.assign({}, request);

  // @ts-ignore
  delete clonedRequest.bypassCache;

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

  if (!request.bypassCache && processedRequests.get(reqId)) {
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

    if (rpcResp.error && typeof rpcResp.error === "object") {
      error = (rpcResp.error as JSONRPCError).message;
    }
  }

  if (error) {
    dbData.error = error as string;
  } else {
    dbData.data = (rpcResp as unknown as JSONRPCResponseWithResult).result;
  }

  if (
    (!processedRequests.get(reqId) || request.bypassCache) &&
    dbData.data?.error !== ERR_NOT_READY
  ) {
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

  (await getDHT("server")).on("connection", RPCConnection.handleRequest);

  await startDns();
}

class RPCConnection {
  private _socket: any;
  constructor(socket: any) {
    this._socket = socket;
    socket.rawStream._ondestroy = () => false;
    socket.once("data", this.checkRpc.bind(this));
  }

  private async checkRpc(data: Buffer) {
    if (data.toString() === "rpc") {
      this._socket.once("data", this.processRequest);
    }
  }

  private async processRequest(data: Buffer) {
    let request: RPCRequest;
    try {
      request = unpack(data) as RPCRequest;
    } catch (e) {
      return;
    }

    const that = this as any;
    let response;
    try {
      response = await maybeProcessRequest(request);
    } catch (error) {
      log.trace(error);
      that.write(pack({ error }));
      that.end();
      return;
    }

    if (response.data?.streamId) {
      const stream = getStream(
        response.data?.streamId
      ) as AsyncIterable<Uint8Array>;
      const emptyData = Uint8Array.from([]);
      const streamResp = {
        data: {
          data: emptyData,
          done: false,
        } as StreamFileResponse,
      };
      for await (const chunk of stream) {
        streamResp.data.data = chunk as unknown as Uint8Array;
        that.write(pack(streamResp));
      }

      streamResp.data.data = emptyData;
      streamResp.data.done = true;
      response = streamResp;
    }

    that.write(pack(response));
    that.end();
  }

  public static handleRequest(socket: any) {
    new RPCConnection(socket);
  }
}
