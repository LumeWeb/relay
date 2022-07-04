import { ethers } from "ethers";
import { PocketAAT } from "@pokt-network/pocket-js";
import { maybeMapChainId, reverseMapChainId } from "../util.js";
import { Connection } from "@solana/web3.js";
import {
  POCKET_APP_ID,
  POCKET_APP_KEY,
  usePocketGateway,
} from "../constants.js";
import { getAat, getPocketServer } from "../rpc.js";

export const chainNetworks = require("../../networks.json");

type RpcProviderMethod = (method: string, params: Array<any>) => Promise<any>;

const gatewayProviders: { [name: string]: RpcProviderMethod } = {};

const gatewayMethods: {
  [name: string]: (chainId: string) => RpcProviderMethod;
} = {
  default: (chainId: string): RpcProviderMethod => {
    const provider = new ethers.providers.JsonRpcProvider({
      url: `https://${chainId}.gateway.pokt.network/v1/lb/${POCKET_APP_ID}`,
      password: <string>POCKET_APP_KEY,
    });
    return provider.send.bind(provider);
  },
  "sol-mainnet": (chainId: string): RpcProviderMethod => {
    const provider = new Connection(
      `https://solana-mainnet.gateway.pokt.network/v1/lb/${POCKET_APP_ID}`
    );

    // @ts-ignore
    return provider._rpcRequest.bind(provider);
  },
};

export function proxyRpcMethod(
  method: string,
  chains: string[] = []
): Function {
  return async function (args: any, context: object) {
    // @ts-ignore
    let chain = context.chain;
    let chainId = maybeMapChainId(chain);

    let chainMatch = true;

    if (
      chains.length > 0 &&
      !chains.includes(chain) &&
      !chains.includes(chainId.toString())
    ) {
      chainMatch = false;
    }

    if (!chainId || !chainMatch) {
      throw new Error("Invalid Chain");
    }

    if (usePocketGateway()) {
      chainId = reverseMapChainId(chainId as string);
      if (!chainId) {
        throw new Error("Invalid Chain");
      }

      let provider: RpcProviderMethod | boolean =
        gatewayProviders[chainId as string] || false;
      if (!provider) {
        provider = getRpcProvider(chainId as string);
      }
      gatewayProviders[chainId as string] = provider;
      return await provider(method, args);
    }

    return await sendRelay(JSON.stringify(args), <string>chainId, getAat());
  };
}

// Call this every time you want to fetch RPC data
async function sendRelay(
  rpcQuery: string,
  blockchain: string,
  pocketAAT: PocketAAT
) {
  try {
    return await getPocketServer().sendRelay(rpcQuery, blockchain, pocketAAT);
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
