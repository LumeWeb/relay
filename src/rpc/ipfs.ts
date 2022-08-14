import { rpcError, RpcMethodList, validateChain } from "./index.js";
import type { IPFS } from "ipfs-core";
import { dynImport } from "../util.js";
import { CID } from "multiformats/cid";
// @ts-ignore
import toStream from "it-to-stream";
import { addStream } from "../streams.js";
import { ERR_HASH_IS_DIRECTORY } from "../error.js";
import type { StatResult } from "ipfs-core/dist/src/components/files/stat";

let client: IPFS | Promise<any>;
let utils: typeof import("ipfs-http-response").utils;
let detectContentType: typeof import("ipfs-http-response").utils.detectContentType;

interface StatFileResponse {
  exists: boolean;
  contentType: string | null;
  error: any;
  directory: boolean;
  files: StatFileSubfile[];
  timeout: boolean;
  size: number;
}

interface StatFileSubfile {
  name: string;
  size: number;
}

function normalizeCidPath(path: any) {
  if (path instanceof Uint8Array) {
    return CID.decode(path).toString();
  }

  path = path.toString();

  if (path.indexOf("/ipfs/") === 0) {
    path = path.substring("/ipfs/".length);
  }

  if (path.charAt(path.length - 1) === "/") {
    path = path.substring(0, path.length - 1);
  }

  return path;
}

async function initIpfs() {
  if (client) {
    if (client instanceof Promise) {
      await client;
    }

    return;
  }

  const IPFS: typeof import("ipfs-http-client") = await dynImport(
    "ipfs-http-client"
  );

  const ipfsHttpResponse: typeof import("ipfs-http-response") = await dynImport(
    "ipfs-http-response"
  );
  utils = ipfsHttpResponse.utils;
  detectContentType = utils.detectContentType;

  client = IPFS.create({
    host: "127.0.0.1",
  });
  client = await client;
}

initIpfs();

function normalizePath(
  hash?: string,
  path?: string,
  fullPath?: string
): string {
  if (!fullPath) {
    if (!path) {
      path = "/";
    }

    fullPath = `${hash}/${path}`;
  }

  fullPath = fullPath.replace(/\/{2,}/, "/");
  return normalizeCidPath(fullPath);
}

async function fetchFile(hash?: string, path?: string, fullPath?: string) {
  let data = await fileExists(hash, path, fullPath);

  if (data instanceof Error) {
    return data;
  }

  if (data?.type === "directory") {
    return rpcError(ERR_HASH_IS_DIRECTORY);
  }

  client = client as IPFS;

  const streamId = addStream(client.cat(data.cid));

  return { streamId };
}

async function statFile(hash?: string, path?: string, fullPath?: string) {
  let stats: StatFileResponse = {
    exists: false,
    contentType: null,
    error: null,
    directory: false,
    files: [],
    timeout: false,
    size: 0,
  };

  client = client as IPFS;

  let exists = await fileExists(hash, path, fullPath);
  fullPath = normalizePath(hash, path, fullPath);

  if (exists instanceof Error) {
    stats.error = exists.toString();

    if (exists.message.includes("aborted")) {
      stats.timeout = true;
    }

    return stats;
  }
  stats.exists = true;

  if (exists?.type === "directory") {
    stats.directory = true;
    for await (const item of client.ls(exists.cid)) {
      stats.files.push({
        name: item.name,
        size: item.size,
      } as StatFileSubfile);
    }
    return stats;
  }

  const { size } = await client.files.stat(`/ipfs/${exists.cid}`);
  stats.size = size;

  const { contentType } = await detectContentType(
    fullPath,
    client.cat(exists.cid)
  );
  stats.contentType = contentType ?? null;

  return stats;
}

async function fileExists(
  hash?: string,
  path?: string,
  fullPath?: string
): Promise<Error | StatResult> {
  await initIpfs();
  client = client as IPFS;
  let ipfsPath = normalizePath(hash, path, fullPath);
  try {
    const controller = new AbortController();
    // setTimeout(() => controller.abort(), 5000);
    const ret = await client.files.stat(`/ipfs/${ipfsPath}`, {
      signal: controller.signal,
    });
    return ret;
  } catch (err: any) {
    return err;
  }
}

async function resolveIpns(
  hash: string,
  path: string
): Promise<string | boolean> {
  client = client as IPFS;

  for await (const result of client.name.resolve(hash)) {
    return normalizePath(undefined, undefined, `${result}/${path}`);
  }

  return false;
}

const CHAIN = "ipfs";

export default {
  stat_ipfs: validateChain(CHAIN, async (args: any) => {
    try {
      return await statFile(args?.hash, args?.path);
    } catch (e: any) {
      return rpcError((e as Error).message);
    }
  }),
  stat_ipns: validateChain(CHAIN, async (args: any) => {
    try {
      let ipfsPath = await resolveIpns(args?.hash, args?.path);
      if (!ipfsPath) {
        throw new Error("ipns lookup failed");
      }
      return statFile(undefined, undefined, ipfsPath as string);
    } catch (e: any) {
      return rpcError((e as Error).message);
    }
  }),

  fetch_ipfs: validateChain(CHAIN, async (args: any) => {
    try {
      const ret = await fetchFile(args?.hash, args?.path);
      if (ret instanceof Error) {
        throw ret;
      }

      return ret;
    } catch (e: any) {
      return rpcError((e as Error).message);
    }
  }),
  fetch_ipns: validateChain(CHAIN, async (args: any) => {
    try {
      let ipfsPath = await resolveIpns(args?.hash, args?.path);
      if (!ipfsPath) {
        throw new Error("ipns lookup failed");
      }
      const ret = await fetchFile(undefined, undefined, ipfsPath as string);
      if (ret instanceof Error) {
        throw ret;
      }

      return ret;
    } catch (e: any) {
      return rpcError((e as Error).message);
    }
  }),
} as RpcMethodList;
