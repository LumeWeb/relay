import {
  RPCMethod,
  RPCRequest,
  RPCResponse,
  RPCStreamHandler,
} from "@lumeweb/relay-types";
import NodeCache from "node-cache";
import { get as getDHT } from "../dht.js";
import { Mutex } from "async-mutex";
import crypto from "crypto";

// @ts-ignore
import stringify from "json-stable-stringify";
import Ajv from "ajv";
import RPCConnection from "./connection.js";
import { RPC_REQUEST_SCHEMA } from "../types.js";

const ajv = new Ajv({ allowUnionTypes: true });
const validateRpcRequest = ajv.compile(RPC_REQUEST_SCHEMA);

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

  public getMethods(): string[] {
    const methods = [];

    for (const module of this.methods.keys()) {
      for (const method of (
        this.methods.get(module) as Map<string, RPCMethod>
      ).keys()) {
        methods.push(`${module}.${method}`);
      }
    }

    return methods;
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
    } else {
      if (result && !result.error && !("data" in result)) {
        result = { data: result };
      }
    }

    result = result as RPCResponse;

    cachedRequest = this.getCachedRequest(request);

    if (!cachedRequest && !isStream && method.cacheable) {
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

    response.updated = Date.now();

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
    let valid: boolean | Error | RPCMethod = validateRpcRequest(request);

    if (!valid) {
      return new Error(ajv.errorsText(validateRpcRequest.errors));
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
      return new Error("INVALID_MODULE");
    }

    item = item.get(method);

    if (!item) {
      return new Error("INVALID_METHOD");
    }

    return item;
  }
}