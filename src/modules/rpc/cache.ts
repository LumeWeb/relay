import EventEmitter from "events";
import DHTCache from "@lumeweb/dht-cache";
import { RPCCacheItem, RPCRequest, RPCResponse } from "@lumeweb/relay-types";
import { get as getSwarm } from "../swarm";
import { RPCServer } from "./server";
// @ts-ignore
import jsonStringify from "json-stringify-deterministic";
// @ts-ignore
import crypto from "hypercore-crypto";
import NodeCache from "node-cache";

export class RPCCache extends EventEmitter {
  private server: RPCServer;

  constructor(server: RPCServer) {
    super();
    this.server = server;
    this._swarm = getSwarm();
    this._dhtCache = new DHTCache(this._swarm, {
      protocol: "lumeweb.rpccache",
    });
    this._data.on("del", (key: string) => {
      try {
        this.deleteItem(key);
      } catch {}
    });
  }

  private _dhtCache?: DHTCache;

  get dhtCache(): DHTCache {
    return this._dhtCache as DHTCache;
  }

  private _swarm?: any;

  get swarm(): any {
    return this._swarm;
  }

  private _data: NodeCache = new NodeCache({ stdTTL: 60 * 60 * 24 });

  get data(): NodeCache {
    return this._data;
  }

  public signResponse(item: RPCCacheItem): string {
    const field = item.value.signedField || "data";
    const updated = item.value.updated;
    // @ts-ignore
    let json = item.value[field];

    if (typeof json !== "string") {
      json = jsonStringify(json);
    }

    return this.server.signData(`${updated}${json}`);
  }

  public verifyResponse(pubkey: Buffer, item: RPCCacheItem): boolean | Buffer {
    const field = item.value.signedField || "data";
    const updated = item.value.updated;
    // @ts-ignore
    let json = item.value[field];

    if (typeof json !== "string") {
      json = jsonStringify(json);
    }

    try {
      if (
        !crypto.verify(
          Buffer.from(`${updated}${json}`),
          Buffer.from(item?.signature as string, "hex"),
          pubkey
        )
      ) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  public addItem(query: RPCRequest, response: RPCResponse) {
    const queryHash = RPCServer.hashQuery(query);

    const clonedResponse = { ...response };

    clonedResponse.updated = Date.now();

    const item = {
      value: clonedResponse,
      signature: "",
    };

    item.signature = this.signResponse(item);

    this._dhtCache?.addItem(queryHash);
    this._data.set(queryHash, item);
  }

  public deleteItem(queryHash: string): boolean {
    const cache = this._dhtCache?.cache;

    if (!cache?.includes(queryHash)) {
      throw Error("item does not exist");
    }

    this._dhtCache?.removeItem(queryHash);
    this._data.del(queryHash);

    return true;
  }
}
