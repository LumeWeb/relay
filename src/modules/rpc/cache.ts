import EventEmitter from "events";
import DHTCache from "@lumeweb/dht-cache";
import {
  RPCCacheData,
  RPCCacheItem,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/relay-types";
import { getRpcByPeer } from "../rpc";
import b4a from "b4a";
import { get as getSwarm } from "../swarm";
import { RPCServer } from "./server";
// @ts-ignore
import orderedJSON from "ordered-json";
// @ts-ignore
import crypto from "hypercore-crypto";

export class RPCCache extends EventEmitter {
  private dhtCache?: DHTCache;
  private server: RPCServer;

  private _swarm?: any;

  get swarm(): any {
    return this._swarm;
  }

  private _data: RPCCacheData = {};

  get data(): RPCCacheData {
    return this._data;
  }

  constructor(server: RPCServer) {
    super();
    this.server = server;
    this._swarm = getSwarm();
    this.dhtCache = new DHTCache(this._swarm, {
      protocol: "lumeweb.rpccache",
    });
  }

  public async getNodeQuery(
    node: string,
    queryHash: string
  ): Promise<boolean | RPCResponse> {
    if (!this.dhtCache?.peerHasItem(node, queryHash)) {
      return false;
    }

    const rpc = await getRpcByPeer(node);

    let response;

    try {
      response = rpc.request("rpc.get_cached_item", queryHash) as RPCCacheItem;
    } catch (e: any) {
      return false;
    }

    if (!this.verifyResponse(b4a.from(node, "hex") as Buffer, response)) {
      return false;
    }

    return { ...response?.value };
  }

  public signResponse(item: RPCCacheItem): string {
    const field = item.value.signedField || "data";
    const updated = item.value.updated;
    // @ts-ignore
    const data = item.value[field];
    const json = orderedJSON.stringify(data);

    return this.server.signData(`${updated}${json}`);
  }

  public verifyResponse(pubkey: Buffer, item: RPCCacheItem): boolean | Buffer {
    const field = item.value.signedField || "data";
    const updated = item.value.updated;
    // @ts-ignore
    const data = item.value[field];
    const json = orderedJSON.stringify(data);

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

    this._data[queryHash] = item;
  }

  public deleteItem(queryHash: string): boolean {
    const cache = this.dhtCache?.cache;

    if (!cache?.includes(queryHash)) {
      throw Error("item does not exist");
    }

    this.dhtCache?.removeItem(queryHash);
    delete this._data[queryHash];

    return true;
  }
}
