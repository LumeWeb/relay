import { JSONSchemaType } from "ajv";
import { PluginApiManager } from "./plugin.js";
import { RPCServer } from "./rpc/server.js";

export interface RPCRequest {
  bypassCache?: boolean;
  module: string;
  method: string;
  data: any;
}

export interface RPCResponse {
  updated?: number;
  data?: any;
  error?: string;
}

export interface RPCMethod {
  cacheable: boolean;
  handler: (
    request: RPCRequest,
    sendStream: (stream: AsyncIterable<Uint8Array>) => void
  ) => Promise<RPCResponse | null>;
}

// @ts-ignore
export const RPC_REQUEST_SCHEMA: JSONSchemaType<RPCRequest> = {
  type: "object",
  properties: {
    module: {
      type: "string",
    },
    method: {
      type: "string",
    },
    data: {
      type: ["number", "string", "boolean", "object", "array"],
    },
    bypassCache: {
      type: "boolean",
      nullable: true,
    },
  },
};

export interface StreamFileResponse {
  data?: Uint8Array;
  done: boolean;
}

export interface PluginAPI {
  config: any;
  registerMethod: (methodName: string, method: RPCMethod) => void;
  loadPlugin: PluginApiManager["loadPlugin"];
  getMethods: RPCServer["getMethods"];
}

export type PluginFunction = (api: PluginAPI) => Promise<void>;

export interface Plugin {
  name: string;
  plugin: PluginFunction;
  exports?: any;
  default?: Plugin;
}

export type RPCStreamHandler = (
  stream: AsyncIterable<Uint8Array>
) => Promise<RPCResponse>;
