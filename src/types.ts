import { JSONSchemaType } from "ajv";
import { PluginApiManager } from "./plugin.js";

export interface RPCRequest {
  bypassCache?: boolean;
  module: string;
  method: string;
  data: string;
}

export interface RPCResponse {
  updated?: number;
  data?: any;
  error?: string;
}

export interface RPCMethod {
  cachable: boolean;
  handler: (
    request: RPCRequest,
    sendStream: (stream: AsyncIterable<Uint8Array>) => void
  ) => Promise<RPCResponse | null>;
}

export const RPC_REQUEST_SCHEMA: JSONSchemaType<RPCRequest> = {
  anyOf: [],
  oneOf: [],
  type: "object",
  properties: {
    module: {
      type: "string",
    },
    method: {
      type: "string",
    },
    data: {
      type: "string",
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "integer" },
        { type: "object" },
        { type: "array" },
      ],
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
}

export type PluginFunction = (api: PluginAPI) => Promise<void>;

export interface Plugin {
  name: string;
  plugin: PluginFunction;
  exports?: any;
}

export type RPCStreamHandler = (
  stream: AsyncIterable<Uint8Array>
) => Promise<RPCResponse>;
