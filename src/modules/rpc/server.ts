import {
  RPCCacheData,
  RPCCacheItem,
  RPCMethod,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/relay-types";
import EventEmitter from "events";
// @ts-ignore
import ProtomuxRPC from "protomux-rpc";
import b4a from "b4a";
import { get as getSwarm, SecretStream } from "../swarm";
// @ts-ignore
import c from "compact-encoding";
import DHTCache from "@lumeweb/dht-cache";
// @ts-ignore
import crypto from "hypercore-crypto";
// @ts-ignore
import orderedJSON from "ordered-json";
import { Mutex } from "async-mutex";
import { RPCCache } from "./cache";

const sodium = require("sodium-universal");
let server: RPCServer;

const RPC_PROTOCOL_ID = b4a.from("lumeweb");
export const RPC_PROTOCOL_SYMBOL = Symbol.for(RPC_PROTOCOL_ID.toString());

export function getRpcServer(): RPCServer {
  if (!server) {
    server = new RPCServer();
  }

  return server as RPCServer;
}

export class RPCServer extends EventEmitter {
  private _modules: Map<string, Map<string, RPCMethod>> = new Map<
    string,
    Map<string, RPCMethod>
  >();
  private pendingRequests: Map<string, Mutex> = new Map<string, Mutex>();

  private _cache: RPCCache = new RPCCache(this);

  get cache(): RPCCache {
    return this._cache;
  }

  public static hashQuery(query: RPCRequest): string {
    const clonedQuery: RPCRequest = {
      module: query.module,
      method: query.method,
      data: query.data,
    };
    const queryHash = Buffer.allocUnsafe(32);
    sodium.crypto_generichash(
      queryHash,
      Buffer.from(orderedJSON.stringify(clonedQuery))
    );
    return queryHash.toString("hex");
  }

  public registerMethod(
    moduleName: string,
    methodName: string,
    options: RPCMethod
  ): void {
    const module = this._modules.get(moduleName);
    if (module && module.get(methodName)) {
      throw new Error(
        `Method ${methodName} already exists for module ${moduleName}`
      );
    }

    let methodMap: Map<string, RPCMethod> | null = null;

    if (!module) {
      methodMap = new Map<string, RPCMethod>();
      this._modules.set(moduleName, methodMap);
    }

    if (!methodMap) {
      methodMap = this._modules.get(moduleName) as Map<string, RPCMethod>;
    }

    methodMap.set(methodName, options);
  }

  public getMethods(): string[] {
    const methods = [];

    for (const module of this._modules.keys()) {
      for (const method of (
        this._modules.get(module) as Map<string, RPCMethod>
      ).keys()) {
        methods.push(`${module}.${method}`);
      }
    }

    return methods;
  }

  public setup(stream: SecretStream) {
    const existing = stream[RPC_PROTOCOL_SYMBOL];
    if (existing) return existing;

    const options = {
      id: RPC_PROTOCOL_ID,
      valueEncoding: c.json,
    };
    const rpc = new ProtomuxRPC(stream, options);

    stream[RPC_PROTOCOL_SYMBOL] = rpc;

    for (const module of this._modules.keys()) {
      for (const method of (
        this._modules.get(module) as Map<string, RPCMethod>
      ).keys()) {
        rpc.respond(`${module}.${method}`, {}, (data: any) =>
          this.handleRequest({ module, method, data })
        );
      }
    }

    return rpc;
  }

  public signData(data: any): string {
    let raw = data;
    if (typeof data !== "string") {
      raw = orderedJSON.stringify(data);
    }

    return crypto
      .sign(Buffer.from(raw, this._cache.swarm.keyPair.privateKey))
      .toString("hex");
  }

  private async handleRequest(request: RPCRequest) {
    let lockedRequest = await this.waitOnRequestLock(request);

    if (lockedRequest) {
      return lockedRequest;
    }

    let cachedRequest = this.getCachedRequest(request) as RPCCacheItem;

    if (cachedRequest) {
      return cachedRequest.value;
    }

    let method = this.getMethodByRequest(request) as RPCMethod;

    let ret;
    let error;

    try {
      ret = (await method.handler(request.data)) as RPCResponse | any;
    } catch (e) {
      error = e;
    }

    if (error) {
      throw error;
    }

    let rpcResult: RPCResponse = {};

    if (ret?.data) {
      rpcResult = { ...ret };

      const field = rpcResult?.signedField || "data";

      // @ts-ignore
      rpcResult.signature = this.signData(rpcResult[field]);
    } else {
      rpcResult = {
        data: ret,
        signature: this.signData(ret),
      };
    }

    if (method.cacheable) {
      this.cache.addItem(request, rpcResult);
    }

    return rpcResult;
  }

  private getCachedRequest(request: RPCRequest): RPCCacheItem | boolean {
    const req = RPCServer.hashQuery(request);
    if (RPCServer.hashQuery(request) in this._cache.data) {
      this._cache.data[req];
    }

    return false;
  }

  private getMethodByRequest(request: RPCRequest): Error | RPCMethod {
    return this.getMethod(request.module, request.method);
  }

  private getMethod(moduleName: string, method: string): Error | RPCMethod {
    let item: any = this._modules.get(moduleName);

    if (!item) {
      return new Error("INVALID_MODULE");
    }

    item = item.get(method);

    if (!item) {
      return new Error("INVALID_METHOD");
    }

    return item;
  }

  private async waitOnRequestLock(
    request: RPCRequest
  ): Promise<RPCCacheItem | undefined> {
    let method = this.getMethodByRequest(request) as RPCMethod;
    if (!method.cacheable) {
      return;
    }

    const reqId = RPCServer.hashQuery(request);

    let lock: Mutex = this.pendingRequests.get(reqId) as Mutex;
    const lockExists = !!lock;

    if (!lockExists) {
      lock = new Mutex();
      this.pendingRequests.set(reqId, lock);
    }

    if (lock.isLocked()) {
      await lock.waitForUnlock();
      if (reqId in this._cache.data) {
        return this._cache.data[reqId] as RPCCacheItem;
      }
    }

    await lock.acquire();
  }
}