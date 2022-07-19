import * as chainNetworks from "./networks.json" assert {type: "json"};
import {Buffer} from "buffer";
import {blake2b} from "libskynet";

type networks = { [net: string]: string };

export function errorExit(msg: string): void {
    console.error(msg);
    process.exit(1);
}

export function maybeMapChainId(chain: string): string | boolean {
    if (chain in chainNetworks) {
        return (chainNetworks as networks)[chain];
    }

    if (
        [parseInt(chain, 16).toString(), parseInt(chain, 10).toString()].includes(
            chain.toLowerCase()
        )
    ) {
        return chain;
    }

    return false;
}

export function reverseMapChainId(chainId: string): string | boolean {
    let vals = Object.values(chainNetworks);
    if (!vals.includes(chainId)) {
        return false;
    }

    return Object.keys(chainNetworks)[vals.indexOf(chainId)];
}

export function isIp(ip: string) {
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        ip
    );
}

export function hashDataKey(dataKey: string): Uint8Array {
    return blake2b(encodeUtf8String(dataKey));
}

function encodeUtf8String(str: string): Uint8Array {
    const byteArray = stringToUint8ArrayUtf8(str);
    const encoded = new Uint8Array(8 + byteArray.length);
    encoded.set(encodeNumber(byteArray.length));
    encoded.set(byteArray, 8);
    return encoded;
}

function stringToUint8ArrayUtf8(str: string): Uint8Array {
    return Uint8Array.from(Buffer.from(str, "utf-8"));
}

function encodeNumber(num: number): Uint8Array {
    const encoded = new Uint8Array(8);
    for (let index = 0; index < encoded.length; index++) {
        encoded[index] = num & 0xff;
        num = num >> 8;
    }
    return encoded;
}
