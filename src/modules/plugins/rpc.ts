import { getRpcServer } from "../rpc/server";
import {
  Plugin,
  PluginAPI,
  RPCBroadcastRequest,
  RPCBroadcastResponse,
  RPCClearCacheRequest,
  RPCClearCacheResponse,
  RPCClearCacheResponseRelayList,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/relay-types";
import { getRpcByPeer } from "../rpc";

async function broadcastRequest(
  request: RPCRequest,
  relays: string[]
): Promise<Map<string, Promise<any>>> {
  const makeRequest = async (relay: string) => {
    const rpc = await getRpcByPeer(relay);
    return rpc.request(`${request.module}.${request.method}`, request.data);
  };

  let relayMap = new Map<string, Promise<any>>();

  for (const relay of relays) {
    relayMap.set(relay, makeRequest(relay));
  }

  await Promise.allSettled([...relays.values()]);
  return relayMap;
}

const plugin: Plugin = {
  name: "rpc",
  async plugin(api: PluginAPI): Promise<void> {
    api.registerMethod("get_cached_item", {
      cacheable: false,
      async handler(req: string): Promise<RPCResponse> {
        if (typeof req !== "string") {
          throw new Error("item must be a string");
        }

        const cache = getRpcServer().cache.data;

        if (!Object.keys(cache).includes(req)) {
          throw new Error("item does not exist");
        }

        return {
          data: true,
          ...cache[req]?.value,
          signature: cache[req]?.signature,
        };
      },
    });
    api.registerMethod("clear_cached_item", {
      cacheable: false,
      async handler(req: string): Promise<RPCClearCacheResponse> {
        if (typeof req !== "string") {
          throw new Error("item must be a string");
        }
        try {
          api.getRpcServer().cache.deleteItem(req);
        } catch (e: any) {
          throw e;
        }

        return {
          data: true,
        };
      },
    });
    api.registerMethod("broadcast_request", {
      cacheable: false,
      async handler(req: RPCBroadcastRequest): Promise<RPCBroadcastResponse> {
        if (!req?.request) {
          throw new Error("request required");
        }
        if (!req?.relays?.length) {
          throw new Error("relays required");
        }

        let resp = await broadcastRequest(req.request, req.relays);

        const result: RPCBroadcastResponse = {
          relays: {},
          data: true,
          signedField: "relays",
        };
        for (const relay in resp) {
          let ret: RPCClearCacheResponse;
          try {
            ret = await resp.get(relay);
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
