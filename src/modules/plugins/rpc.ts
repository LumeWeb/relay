import { getRpcServer } from "../rpc/server";
import {
  Plugin,
  PluginAPI,
  RPCBroadcastRequest,
  RPCBroadcastResponse,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/relay-types";
import { getRpcByPeer } from "../rpc";
import { get as getSwarm } from "../swarm";
import b4a from "b4a";

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
    let req;
    if (b4a.equals(b4a.from(relay, "hex"), getSwarm().keyPair.publicKey)) {
      req = getRpcServer().handleRequest(request);
    } else {
      req = makeRequest(relay);
    }

    relayMap.set(
      relay,
      req.catch((error: Error) => error)
    );
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
      async handler(req: string): Promise<void> {
        if (typeof req !== "string") {
          throw new Error("item must be a string");
        }
        try {
          api.getRpcServer().cache.deleteItem(req);
        } catch (e: any) {
          throw e;
        }
      },
    });
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

        let resp = await broadcastRequest(req.request, req.relays);

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
