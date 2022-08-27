import {
  RPC_REQUEST_SCHEMA,
  RPCMethod,
  RPCRequest,
  RPCResponse,
  RPCStreamHandler,
} from "../types.js";
import NodeCache from "node-cache";
import { get as getDHT } from "../dht.js";
import { Mutex } from "async-mutex";
import crypto from "crypto";

// @ts-ignore
import stringify from "json-stable-stringify";
import Ajv from "ajv";
import RPCConnection from "./connection.js";

const ajv = new Ajv();
ajv.addSchema(RPC_REQUEST_SCHEMA, "rpc_request");

let server: RPCServer;

export function getRpcServer(): RPCServer {
  if (!server) {
    server = new RPCServer();
  }

  return server as RPCServer;
}
export class RPCServer {
  private methods = new Map<string, Map<string, RPCMethod>>();
  private pendingRequests = new NodeCache();
  private processedRequests = new NodeCache({
    stdTTL: 60 * 60 * 12,
  });

  constructor() {
    this.init();
  }

  public registerMethod(
    moduleName: string,
    methodName: string,
    options: RPCMethod
  ): void {
    const module = this.methods.get(moduleName);
    if (module && module.get(methodName)) {
      throw new Error(
        `Method ${methodName} already exists for module ${moduleName}`
      );
    }

    let methodMap: Map<string, RPCMethod> | null = null;

    if (!module) {
      methodMap = new Map<string, RPCMethod>();
      this.methods.set(moduleName, methodMap);
    }

    if (!methodMap) {
      methodMap = this.methods.get(moduleName) as Map<string, RPCMethod>;
    }

    methodMap.set(methodName, options);
  }

  private async init(): Promise<void> {
    (await getDHT("server")).on(
      "connection",
      (socket: any) => new RPCConnection(socket)
    );
  }

  public async handleRequest(
    request: RPCRequest,
    streamHandler: RPCStreamHandler
  ): Promise<RPCResponse> {
    let valid = this.verifyRequest(request);

    if (valid instanceof Error) {
      return {
        error: valid.message,
      };
    }

    let lockedRequest = await this.waitOnRequestLock(request);

    if (lockedRequest) {
      return lockedRequest;
    }

    let cachedRequest = this.getCachedRequest(request);

    if (cachedRequest) {
      return cachedRequest;
    }

    let method = this.getMethodByRequest(request) as RPCMethod;

    let result;
    let isStream: AsyncIterable<Uint8Array> | boolean = false;
    const flagIsStream = (stream: AsyncIterable<Uint8Array>) => {
      isStream = stream;
    };
    try {
      result = await method.handler(request, flagIsStream);
    } catch (e) {
      return {
        error: (e as Error).message,
      };
    }

    if (isStream) {
      result = await streamHandler(isStream);
    }

    result = result as RPCResponse;

    cachedRequest = this.getCachedRequest(request);

    if (!cachedRequest && !isStream) {
      this.cacheRequest(request, result);
    }

    return result;
  }

  private async waitOnRequestLock(request: RPCRequest) {
    let method = this.getMethodByRequest(request) as RPCMethod;
    if (!method.cacheable) {
      return;
    }

    const reqId = RPCServer.getRequestId(request);

    let lock: Mutex = this.pendingRequests.get(reqId) as Mutex;
    const lockExists = !!lock;

    if (!lockExists) {
      lock = new Mutex();
      this.pendingRequests.set(reqId, lock);
    }

    if (lock.isLocked()) {
      await lock.waitForUnlock();
      return this.processedRequests.get(reqId) as RPCResponse;
    }

    await lock.acquire();
  }

  private getCachedRequest(request: RPCRequest): RPCResponse | undefined {
    let method = this.getMethodByRequest(request) as RPCMethod;
    if (!method.cacheable) {
      return;
    }

    const reqId = RPCServer.getRequestId(request);

    if (!request.bypassCache && this.processedRequests.get(reqId)) {
      return this.processedRequests.get(reqId) as RPCResponse;
    }
  }

  private cacheRequest(request: RPCRequest, response: RPCResponse): void {
    const reqId = RPCServer.getRequestId(request);

    this.processedRequests.set(reqId, response);
  }

  private static hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private static getRequestId(request: RPCRequest) {
    const clonedRequest = Object.assign({}, request) as RPCRequest;

    delete clonedRequest.bypassCache;

    return RPCServer.hash(stringify(clonedRequest));
  }

  private verifyRequest(request: RPCRequest) {
    let valid: any = ajv.getSchema("rpc_request")?.(request);
    if (!valid) {
      return new Error("Invalid request");
    }

    valid = this.getMethodByRequest(request);

    if (valid instanceof Error) {
      return valid;
    }

    return true;
  }

  private getMethodByRequest(request: RPCRequest): Error | RPCMethod {
    return this.getMethod(request.module, request.method);
  }

  private getMethod(moduleName: string, method: string): Error | RPCMethod {
    let item: any = this.methods.get(moduleName);

    if (!item) {
      return new Error("Invalid module");
    }

    item = item.get(method);

    if (!item) {
      return new Error("Invalid method");
    }

    return item;
  }
}
