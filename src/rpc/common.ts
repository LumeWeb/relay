import { ethers } from "ethers";
import { Pocket, PocketAAT } from "@pokt-network/pocket-js/dist/index.js";
import { maybeMapChainId, reverseMapChainId } from "../util.js";
import { Connection } from "@solana/web3.js";
import { getAat, getPocketServer } from "../rpc.js";
import config, { usePocketGateway } from "../config.js";
import { ERR_INVALID_CHAIN } from "../error.js";

type RpcProviderMethod = (method: string, params: Array<any>) => Promise<any>;

interface RpcContext {
  chain?: string;
}

const gatewayProviders: { [name: string]: RpcProviderMethod } = {};

const gatewayMethods: {
  [name: string]: (chainId: string) => RpcProviderMethod;
} = {
  default: (chainId: string): RpcProviderMethod => {
    const provider = new ethers.providers.JsonRpcProvider({
      url: `https://${chainId}.gateway.pokt.network/v1/lb/${config.str(
        "pocket-app-id"
      )}`,
      password: config.str("pocket-app-key"),
    });
    return provider.send.bind(provider);
  },
  "sol-mainnet": (chainId: string): RpcProviderMethod => {
    const provider = new Connection(
      `https://solana-mainnet.gateway.pokt.network/v1/lb/${config.str(
        "pocket-app-key"
      )}`
    );

    // @ts-ignore
    return provider._rpcRequest.bind(provider);
  },
};

export function proxyRpcMethod(
  method: string,
  chains: string[] = []
): Function {
  return async function (args: any, context: RpcContext) {
    // @ts-ignore
    let chain = context.chain;
    let chainId = maybeMapChainId(chain as string);

    let chainMatch = true;

    if (
      chains.length > 0 &&
      !chains.includes(chain as string) &&
      !chains.includes(chainId.toString())
    ) {
      chainMatch = false;
    }

    if (!chainId || !chainMatch) {
      return rpcError(ERR_INVALID_CHAIN);
    }

    if (usePocketGateway()) {
      chainId = reverseMapChainId(chainId as string);
      if (!chainId) {
        return rpcError(ERR_INVALID_CHAIN);
      }

      let provider: RpcProviderMethod | boolean =
        gatewayProviders[chainId as string] || false;
      if (!provider) {
        provider = getRpcProvider(chainId as string);
      }
      gatewayProviders[chainId as string] = provider;

      let resp;
      try {
        resp = await provider(method, args);
      } catch (e: any) {
        e = e as Error;
        if ("error" in e) {
          return e.error;
        }

        return e;
      }

      return resp;
    }

    return await sendRelay(
      JSON.stringify(args),
      <string>chainId,
      getAat() as unknown as PocketAAT
    );
  };
}

// Call this every time you want to fetch RPC data
async function sendRelay(
  rpcQuery: string,
  blockchain: string,
  pocketAAT: PocketAAT
) {
  try {
    return await (getPocketServer() as unknown as Pocket).sendRelay(
      rpcQuery,
      blockchain,
      pocketAAT
    );
  } catch (e) {
    console.log(e);
    throw e;
  }
}

function getRpcProvider(chain: string): RpcProviderMethod {
  if (chain in gatewayMethods) {
    return gatewayMethods[chain](chain);
  }

  return gatewayMethods.default(chain);
}

class RpcError extends Error {
  public code: number = -1;
}

export function rpcError(message: string): Promise<RpcError> {
  return Promise.reject(new RpcError(message));
}

export function validateChain(chain: string, handler: any) {
  return async (args: any, context: RpcContext) => {
    if (!context?.chain || "hns" !== context?.chain) {
      return rpcError(ERR_INVALID_CHAIN);
    }

    return handler(args, context);
  };
}
