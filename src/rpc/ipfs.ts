import { rpcError, RpcMethodList, validateChain } from "./index.js";
import type { IPFS } from "ipfs-core";
import type { UnixFSEntry } from "ipfs-core/dist/src/utils";
import { dynImport } from "../util.js";
import { exporter } from "ipfs-unixfs-exporter";
// @ts-ignore
import { CID } from "multiformats/cid";
import { MemoryDatastore } from "datastore-core";
import { MemoryBlockstore } from "blockstore-core";
import { createRepo } from "ipfs-repo";
// @ts-ignore
import { MemoryLock } from "ipfs-repo/locks/memory";
// @ts-ignore
import * as rawCodec from "multiformats/codecs/raw";
import last from "it-last";
// @ts-ignore
import toStream from "it-to-stream";
import { addStream } from "../streams.js";
import { bases } from "multiformats/basics";
import { ERR_HASH_IS_DIRECTORY } from "../error.js";

let client: IPFS | Promise<any>;
let resolver: typeof import("ipfs-http-response").resolver;
let utils: typeof import("ipfs-http-response").utils;
let detectContentType: typeof import("ipfs-http-response").utils.detectContentType;
let normalizeCidPath: typeof import("ipfs-core/dist/src/utils.js").normalizeCidPath;

const repo = createRepo(
  "",
  async () => rawCodec,
  {
    blocks: new MemoryBlockstore(),
    datastore: new MemoryDatastore(),
    keys: new MemoryDatastore(),
    pins: new MemoryDatastore(),
    root: new MemoryDatastore(),
  },
  { autoMigrate: false, repoLock: MemoryLock, repoOwner: true }
);

interface StatFileResponse {
  exists: boolean;
  contentType: string | null;
  error: any;
  directory: boolean;
  files: StatFileSubfile[];
  timeout: boolean;
}

interface StatFileSubfile {
  name: string;
  size: number;
}

async function initIpfs() {
  if (client) {
    if (client instanceof Promise) {
      await client;
    }

    return;
  }

  const IPFS: typeof import("ipfs-core") = await dynImport("ipfs-core");

  const ipfsHttpResponse: typeof import("ipfs-http-response") = await dynImport(
    "ipfs-http-response"
  );
  normalizeCidPath = (await dynImport("ipfs-core/src/utils.js"))
    .normalizeCidPath;
  resolver = ipfsHttpResponse.resolver;
  utils = ipfsHttpResponse.utils;
  detectContentType = utils.detectContentType;

  client = IPFS.create({
    //  relay: { hop: { enabled: false } },
    silent: true,
    repo,
  });
  client = await client;
}

function joinURLParts(...urls: string[]) {
  urls = urls.filter((url) => url.length > 0);
  urls = [""].concat(urls.map((url) => removeSlashFromBothEnds(url)));

  return urls.join("/");
}

function removeSlashFromBothEnds(url: string): string {
  url = removeLeadingSlash(url);
  url = removeTrailingSlash(url);

  return url;
}

function removeLeadingSlash(url: string): string {
  if (url[0] === "/") {
    url = url.substring(1);
  }

  return url;
}

export function removeTrailingSlash(url: string): string {
  if (url.endsWith("/")) {
    url = url.substring(0, url.length - 1);
  }

  return url;
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

  const streamId = addStream(data.content());

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
    stats.files = exists.node.Links.map((item) => {
      return {
        name: item.Name,
        size: item.Tsize,
      } as StatFileSubfile;
    });
    return stats;
  }

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
): Promise<Error | UnixFSEntry> {
  await initIpfs();
  client = client as IPFS;
  let ipfsPath = normalizePath(hash, path, fullPath);
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    return await exporter(ipfsPath, repo.blocks, { signal: controller.signal });
  } catch (err: any) {
    return err;
  }
}

async function resolveIpns(hash: string, path: string): Promise<string> {
  switch (hash.substring(0, 1)) {
    case bases.base36.prefix: {
      hash = CID.parse(hash, bases.base36).toString();
    }
  }
  let fullPath = `${hash}/${path}`.replace(/\/+/, "/");

  client = client as IPFS;

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);

  return (
    (await last(
      client.name.resolve(fullPath, {
        recursive: true,
        signal: controller.signal,
      })
    )) || path
  );
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
    let ipfsPath;

    try {
      ipfsPath = await resolveIpns(args.hash, args.path);

      return statFile(undefined, undefined, ipfsPath);
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
    let ipfsPath;
    try {
      ipfsPath = await resolveIpns(args.hash, args.path);
      const ret = await fetchFile(undefined, undefined, ipfsPath);
      if (ret instanceof Error) {
        throw ret;
      }

      return ret;
    } catch (e: any) {
      return rpcError((e as Error).message);
    }
  }),
} as RpcMethodList;
