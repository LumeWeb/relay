import {
  RPCRequest,
  RPCResponse,
  RPCStreamHandler,
  StreamFileResponse,
} from "../types";
import { pack, unpack } from "msgpackr";
import log from "loglevel";
import { getRpcServer } from "./server";

export default class RPCConnection {
  private _socket: any;
  constructor(socket: any) {
    this._socket = socket;
    socket.rawStream._ondestroy = () => false;
    socket.once("data", this.checkRpc.bind(this));
  }

  private async checkRpc(data: Buffer) {
    if (data.toString() === "rpc") {
      this._socket.once("data", this.processRequest);
    }
  }

  private async processRequest(data: Buffer) {
    let request: RPCRequest;
    try {
      request = unpack(data) as RPCRequest;
    } catch (e) {
      return;
    }

    const that = this as any;
    let response;

    const handleStream: RPCStreamHandler = async (
      stream: AsyncIterable<Uint8Array>
    ): Promise<RPCResponse> => {
      const emptyData = Uint8Array.from([]);
      const streamResp = {
        data: {
          data: emptyData,
          done: false,
        } as StreamFileResponse,
      };
      for await (const chunk of stream) {
        streamResp.data.data = chunk as unknown as Uint8Array;
        that.write(pack(streamResp));
      }

      streamResp.data.data = emptyData;
      streamResp.data.done = true;
      return streamResp;
    };

    try {
      response = await getRpcServer().handleRequest(request, handleStream);
    } catch (error) {
      log.trace(error);
      that.write(pack({ error }));
      that.end();
      return;
    }
    that.write(pack(response));
    that.end();
  }
}
