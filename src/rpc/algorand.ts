import { maybeMapChainId, reverseMapChainId } from "../util.js";
import minimatch from "minimatch";
// @ts-ignore
import HTTPClient from "algosdk/dist/cjs/src/client/client.js";
import { sprintf } from "sprintf-js";
import { rpcError, RpcMethodList } from "./index.js";
import config from "../config.js";
import {
  ERR_ENDPOINT_INVALID,
  ERR_INVALID_CHAIN,
  ERR_METHOD_INVALID,
} from "../error.js";

const allowedEndpoints: { [endpoint: string]: ("GET" | "POST")[] } = {
  "/v2/teal/compile": ["POST"],
  "/v2/accounts/*": ["GET"],
};

export function proxyRestMethod(
  apiServer: string,
  matchChainId: string
): Function {
  return async function (args: any, context: object) {
    // @ts-ignore
    let chain = context.chain;
    let chainId = maybeMapChainId(chain);

    if (!chainId) {
      return rpcError(ERR_INVALID_CHAIN);
    }

    chainId = reverseMapChainId(chainId as string);
    if (!chainId || chainId !== matchChainId) {
      return rpcError(ERR_INVALID_CHAIN);
    }

    let method = args.method ?? false;
    let endpoint = args.endpoint ?? false;
    let data = args.data ?? false;
    let query = args.query ?? false;
    let fullHeaders = args.fullHeaders ?? {};

    fullHeaders = { ...fullHeaders, Referer: "lumeweb_dns_relay" };

    if (method) {
      method = method.toUpperCase();
    }

    if (!endpoint) {
      throw new Error("Endpoint Missing");
    }

    let found = false;

    for (const theEndpoint in allowedEndpoints) {
      if (minimatch(endpoint, theEndpoint)) {
        found = true;
        break;
      }
    }

    if (!found) {
      return rpcError(ERR_ENDPOINT_INVALID);
    }

    let apiUrl;
    try {
      apiUrl = sprintf(apiServer, chainId, config.str("pocket-app-id"));
    } catch (e) {
      apiUrl = apiServer;
    }

    const client = new HTTPClient({}, apiUrl);
    let resp;
    switch (method) {
      case "GET":
        resp = await client.get(endpoint, query, fullHeaders);
        break;
      case "POST":
        if (Array.isArray(data?.data)) {
          data = new Uint8Array(Buffer.from(data.data));
        }

        resp = await client.post(endpoint, data, { ...fullHeaders });
        break;
      default:
        return rpcError(ERR_METHOD_INVALID);
    }

    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key: string, value: any): any => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return;
          }
          seen.add(value);
        }
        return value;
      };
    };

    if (resp?.body && "current-round" in resp?.body) {
      delete resp?.body["current-round"];
    }
    return JSON.parse(JSON.stringify(resp?.body, getCircularReplacer()));
  };
}

export default {
  algorand_rest_request: proxyRestMethod(
    "http://mainnet-api.algonode.network",
    "algorand-mainnet"
  ),
  //'algorand_rest_request': proxyRestMethod("https://%s.gateway.pokt.network/v1/lb/%s", "algorand-mainnet"),
  algorand_rest_indexer_request: proxyRestMethod(
    "http://mainnet-idx.algonode.network",
    "algorand-mainnet-indexer"
  ),
} as RpcMethodList;
