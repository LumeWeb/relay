import type {
  RPCRequest,
  RPCResponse,
  RPCStreamHandler,
  StreamFileResponse,
} from "@lumeweb/relay-types";
import { pack, unpack } from "msgpackr";
import log from "loglevel";
import { getRpcServer } from "./server";

interface CancelRequest {
  cancel: true;
}

export default class RPCConnection {
  private _socket: any;
  private _canceled = false;
  constructor(socket: any) {
    this._socket = socket;
    socket.rawStream._ondestroy = () => false;
    socket.once("data", this.checkRpc.bind(this));
  }

  private async checkRpc(data: Buffer) {
    if (data.toString() === "rpc") {
      this._socket.once("data", this.processRequest);
      this._socket.on("data", this.listenForCancel);
    }
  }
  private async listenForCancel(data: Buffer) {
    let request: any;
    try {
      request = unpack(data) as CancelRequest;
    } catch (e) {
      return;
    }

    if (request.cancel) {
      this._canceled = true;
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
        if (this._canceled) {
          break;
        }
        streamResp.data.data = chunk as unknown as Uint8Array;
        await new Promise((resolve) => setTimeout(resolve, 15));
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
    if (!this._canceled) {
      that.write(pack(response));
    }
    that.end();
  }
}
