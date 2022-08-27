import { JSONSchemaType } from "ajv";
import { PluginAPI } from "./plugin.js";

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
  ) => RPCResponse | null;
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
export interface RelayPluginAPI {
  config: any;
  api: {
    registerMethod: (methodName: string, method: RPCMethod) => void;
    loadPlugin: PluginAPI["loadPlugin"];
  };
}

export type PluginFunction = (api: RelayPluginAPI) => Promise<void>;
export interface Plugin {
  name: string;
  plugin: PluginFunction;
  exports?: any;
}

export type RPCStreamHandler = (
  stream: AsyncIterable<Uint8Array>
) => Promise<RPCResponse>;
