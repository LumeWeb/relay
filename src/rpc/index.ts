export type RpcMethodList = { [name: string]: Function };

export * from "./common.js";

import {default as DnsMethods} from "./dns.js";
import {default as EvmMethods} from "./evm.js";
import {default as HnsMethods} from "./handshake.js";
import {default as SolMethods} from "./solana.js";
import {default as AlgoMethods} from "./algorand.js";

export const rpcMethods: RpcMethodList = Object.assign(
    {},
    DnsMethods,
    EvmMethods,
    HnsMethods,
    SolMethods,
    AlgoMethods
);
