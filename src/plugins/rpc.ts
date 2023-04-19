import {
  Plugin,
  PluginAPI,
  RPCBroadcastRequest,
  RPCBroadcastResponse,
  RPCCacheItem,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/interface-relay";
import { getRpcByPeer } from "../modules/rpc";
import { get as getSwarm, LUMEWEB_TOPIC_HASH } from "../modules/swarm";
import b4a from "b4a";
import pTimeout, { ClearablePromise } from "p-timeout";

let api: PluginAPI;

async function broadcastRequest(
  request: RPCRequest,
  relays: string[],
  timeout = 5000
): Promise<Map<string, Promise<any>>> {
  const makeRequest = async (relay: string) => {
    const rpc = await getRpcByPeer(relay);
    return rpc.request(`${request.module}.${request.method}`, request.data);
  };

  let relayMap = new Map<string, ClearablePromise<any>>();

  for (const relay of relays) {
    let req;
    if (b4a.equals(b4a.from(relay, "hex"), getSwarm().keyPair.publicKey)) {
      req = api.rpcServer.handleRequest(request);
    } else {
      req = makeRequest(relay);
    }

    let timeoutPromise = pTimeout(req, {
      milliseconds: timeout,
      message: `relay timed out after ${timeout} milliseconds`,
    });

    relayMap.set(relay, timeoutPromise);
  }

  await Promise.allSettled([...relays.values()]);
  return relayMap;
}

const plugin: Plugin = {
  name: "rpc",
  async plugin(_api: PluginAPI): Promise<void> {
    api = _api;
    api.registerMethod("broadcast_request", {
      cacheable: false,
      async handler(req: RPCBroadcastRequest): Promise<RPCBroadcastResponse> {
        if (!req?.request) {
          throw new Error("request required");
        }
        if (!req?.request?.module) {
          throw new Error("request.module required");
        }
        if (!req?.request?.method) {
          throw new Error("request.method required");
        }
        if (!req?.relays?.length) {
          throw new Error("relays required");
        }

        if (
          req?.request?.module === "rpc" &&
          req?.request?.method === "broadcast_request"
        ) {
          throw new Error("recursive broadcast_request calls are not allowed");
        }

        let resp = await broadcastRequest(req.request, req.relays, req.timeout);

        const result: RPCBroadcastResponse = {
          relays: {},
          data: true,
          signedField: "relays",
        };
        for (const relay of resp.keys()) {
          let ret: RPCResponse | Error;
          try {
            ret = await resp.get(relay);
            if (ret instanceof Error) {
              result.relays[relay] = { error: ret.message };
            } else {
              result.relays[relay] = ret as RPCResponse;
            }
          } catch (e: any) {
            result.relays[relay] = { error: e.message };
          }
        }

        return result;
      },
    });
  },
};

export default plugin;
