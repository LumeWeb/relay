import {
  addContextToErr,
  blake2b,
  bufToHex,
  Ed25519Keypair,
  ed25519Sign,
  encodePrefixedBytes,
  encodeU64,
  Err,
} from "libskynet";
import { progressiveFetch } from "libskynetnode/dist/progressivefetch.js";
import { defaultPortalList } from "libskynet/dist/defaultportals.js";
import { readRegistryEntry } from "libskynetnode/dist/registryread.js";
import {
  bufToB64,
  decryptFileSmall,
  deriveChildSeed,
  deriveRegistryEntryID,
  encryptFileSmall,
  entryIDToSkylink,
  namespaceInode,
  skylinkToResolverEntryData,
  taggedRegistryEntryKeys,
} from "libskynet";
import { upload } from "libskynetnode";
// @ts-ignore
import { SkynetClient } from "@skynetlabs/skynet-nodejs";

const ERR_EXISTS = "exists";
const ERR_NOT_EXISTS = "DNE";
const STD_FILENAME = "file";

type OverwriteDataFn = (newData: Uint8Array) => Promise<Err>;

type ReadDataFn = () => Promise<[Uint8Array, Err]>;

export interface IndependentFileSmallMetadata {
  largestHistoricSize: bigint;
}

export interface IndependentFileSmall {
  dataKey: Uint8Array;
  fileData: Uint8Array;
  inode: string;
  keypair: Ed25519Keypair;
  metadata: IndependentFileSmallMetadata;
  revision: bigint;
  seed: Uint8Array;

  skylink: string;
  viewKey: string;

  overwriteData: OverwriteDataFn;

  readData: ReadDataFn;
}

interface IndependentFileSmallViewer {
  fileData: Uint8Array;
  skylink: string;
  viewKey: string;

  readData: ReadDataFn;
}

function overwriteRegistryEntry(
  keypair: any,
  datakey: Uint8Array,
  data: Uint8Array,
  revision: bigint
): Promise<null> {
  return new Promise((resolve, reject) => {
    if (data.length > 86) {
      reject("provided data is too large to fit in a registry entry");
      return;
    }

    let [encodedRevision, errU64] = encodeU64(revision);
    if (errU64 !== null) {
      reject(addContextToErr(errU64, "unable to encode revision number"));
      return;
    }

    let datakeyHex = bufToHex(datakey);
    let [encodedData, errEPB] = encodePrefixedBytes(data);
    if (errEPB !== null) {
      reject(addContextToErr(errEPB, "unable to encode the registry data"));
      return;
    }
    let dataToSign = new Uint8Array(32 + 8 + data.length + 8);
    dataToSign.set(datakey, 0);
    dataToSign.set(encodedData, 32);
    dataToSign.set(encodedRevision, 32 + 8 + data.length);
    let sigHash = blake2b(dataToSign);
    let [sig, errS] = ed25519Sign(sigHash, keypair.secretKey);
    if (errS !== null) {
      reject(addContextToErr(errS, "unable to produce signature"));
      return;
    }

    let postBody = {
      publickey: {
        algorithm: "ed25519",
        key: Array.from(keypair.publicKey),
      },
      datakey: datakeyHex,
      revision: Number(revision),
      data: Array.from(data),
      signature: Array.from(sig),
    };
    let fetchOpts = {
      method: "post",
      body: JSON.stringify(postBody),
    };
    let endpoint = "/skynet/registry";

    progressiveFetch(
      endpoint,
      fetchOpts,
      defaultPortalList,
      verifyRegistryWrite
    ).then((result) => {
      if (result.success === true) {
        resolve(null);
        return;
      }
      reject("unable to write registry entry\n" + JSON.stringify(result));
    });
  });
}
function verifyRegistryWrite(response: Response): Promise<Err> {
  return new Promise((resolve) => {
    if (!("status" in response)) {
      resolve("response did not contain a status");
      return;
    }
    if (response.status === 204) {
      resolve(null);
      return;
    }
    resolve("unrecognized status");
  });
}

function createIndependentFileSmall(
  seed: Uint8Array,
  userInode: string,
  fileData: Uint8Array
): Promise<[IndependentFileSmall, Err]> {
  return new Promise(async (resolve) => {
    let [inode, errNI] = namespaceInode("IndependentFileSmall", userInode);
    if (errNI !== null) {
      resolve([{} as any, addContextToErr(errNI, "unable to namespace inode")]);
      return;
    }

    let [keypair, dataKey, errTREK] = taggedRegistryEntryKeys(
      seed,
      inode,
      inode
    );
    if (errTREK !== null) {
      resolve([
        {} as any,
        addContextToErr(
          errTREK,
          "unable to get registry entry for provided inode"
        ),
      ]);
      return;
    }

    let result;
    try {
      result = await readRegistryEntry(keypair.publicKey, dataKey);
    } catch (e) {
      result = { exists: false };
    }
    if (result.exists === true) {
      resolve([{} as any, "exists"]);
      return;
    }

    let encryptionKey = deriveChildSeed(seed, inode);
    let metadata: IndependentFileSmallMetadata = {
      largestHistoricSize: BigInt(fileData.length),
    };

    let revisionSeed = new Uint8Array(seed.length + 8);
    revisionSeed.set(seed, 0);
    let revisionKey = deriveChildSeed(revisionSeed, inode);
    let revision = BigInt(revisionKey[0]) * 256n + BigInt(revisionKey[1]);
    let [encryptedData, errEF] = encryptFileSmall(
      encryptionKey,
      inode,
      revision,
      metadata,
      fileData,
      metadata.largestHistoricSize
    );
    if (errEF !== null) {
      resolve([{} as any, addContextToErr(errEF, "unable to encrypt file")]);
      return;
    }

    let immutableSkylink;

    try {
      immutableSkylink = await upload(encryptedData, {
        Filename: STD_FILENAME,
      });
    } catch (e) {
      resolve([{} as any, addContextToErr(e, "upload failed")]);
      return;
    }

    let [entryData, errSTRED] = skylinkToResolverEntryData(immutableSkylink);
    if (errSTRED !== null) {
      resolve([
        {} as any,
        addContextToErr(
          errSTRED,
          "couldn't create resovler link from upload skylink"
        ),
      ]);
      return;
    }

    try {
      await overwriteRegistryEntry(keypair, dataKey, entryData, revision);
    } catch (e: any) {
      resolve([
        {} as any,
        addContextToErr(e, "could not write to registry entry"),
      ]);
      return;
    }

    let [entryID, errDREID] = deriveRegistryEntryID(keypair.publicKey, dataKey);
    if (errDREID !== null) {
      resolve([
        {} as any,
        addContextToErr(errDREID, "could not compute entry id"),
      ]);
      return;
    }
    let skylink = entryIDToSkylink(entryID);

    let encStr = bufToB64(encryptionKey);
    let viewKey = encStr + inode;

    let ifile: IndependentFileSmall = {
      dataKey,
      fileData,
      inode,
      keypair,
      metadata,
      revision,
      seed,

      skylink,
      viewKey,

      overwriteData: function (newData: Uint8Array): Promise<Err> {
        return overwriteIndependentFileSmall(ifile, newData);
      },
      readData: function (): Promise<[Uint8Array, Err]> {
        return new Promise((resolve) => {
          let data = new Uint8Array(ifile.fileData.length);
          data.set(ifile.fileData, 0);
          resolve([data, null]);
        });
      },
    };
    resolve([ifile, null]);
  });
}

function openIndependentFileSmall(
  seed: Uint8Array,
  userInode: string
): Promise<[IndependentFileSmall, Err]> {
  return new Promise(async (resolve) => {
    let [inode, errNI] = namespaceInode("IndependentFileSmall", userInode);
    if (errNI !== null) {
      resolve([{} as any, addContextToErr(errNI, "unable to namespace inode")]);
      return;
    }

    let [keypair, dataKey, errTREK] = taggedRegistryEntryKeys(
      seed,
      inode,
      inode
    );
    if (errTREK !== null) {
      resolve([
        {} as any,
        addContextToErr(
          errTREK,
          "unable to get registry entry for provided inode"
        ),
      ]);
      return;
    }

    let result;
    try {
      result = await readRegistryEntry(keypair.publicKey, dataKey);
    } catch (e: any) {
      resolve([
        {} as any,
        addContextToErr(e, "unable to read registry entry for file"),
      ]);
      return;
    }
    if (result.exists !== true) {
      resolve([{} as any, ERR_NOT_EXISTS]);
      return;
    }

    let [entryID, errDREID] = deriveRegistryEntryID(keypair.publicKey, dataKey);
    if (errDREID !== null) {
      resolve([
        {} as any,
        addContextToErr(errDREID, "unable to derive registry entry id"),
      ]);
      return;
    }
    let skylink = entryIDToSkylink(entryID);

    const client = new SkynetClient("https://web3portal.com");
    let encryptedData;
    try {
      encryptedData = await client.downloadData(skylink);
    } catch (e: any) {
      resolve([{} as any, addContextToErr(e, "unable to download file")]);
      return;
    }

    let encryptionKey = deriveChildSeed(seed, inode);
    let [metadata, fileData, errDF] = decryptFileSmall(
      encryptionKey,
      inode,
      encryptedData
    );
    if (errDF !== null) {
      resolve([{} as any, addContextToErr(errDF, "unable to decrypt file")]);
      return;
    }

    let encStr = bufToB64(encryptionKey);
    let viewKey = encStr + inode;

    let ifile: IndependentFileSmall = {
      dataKey,
      fileData,
      inode,
      keypair,
      metadata,
      revision: result.revision!,
      seed,

      skylink,
      viewKey,

      overwriteData: function (newData: Uint8Array): Promise<Err> {
        return overwriteIndependentFileSmall(ifile, newData);
      },

      readData: function (): Promise<[Uint8Array, Err]> {
        return new Promise((resolve) => {
          let data = new Uint8Array(ifile.fileData.length);
          data.set(ifile.fileData, 0);
          resolve([data, null]);
        });
      },
    };
    resolve([ifile, null]);
  });
}
function overwriteIndependentFileSmall(
  file: IndependentFileSmall,
  newData: Uint8Array
): Promise<Err> {
  return new Promise(async (resolve) => {
    // Create a new metadata for the file based on the current file
    // metadata. Need to update the largest historic size.
    let newMetadata: IndependentFileSmallMetadata = {
      largestHistoricSize: BigInt(file.metadata.largestHistoricSize),
    };
    if (BigInt(newData.length) > newMetadata.largestHistoricSize) {
      newMetadata.largestHistoricSize = BigInt(newData.length);
    }

    // Compute the new revision number for the file. This is done
    // deterministically using the seed and the current revision number, so
    // that multiple concurrent updates will end up with the same revision.
    // We use a random number between 1 and 256 for our increment.
    let [encodedRevision, errEU64] = encodeU64(file.revision);
    if (errEU64 !== null) {
      resolve(addContextToErr(errEU64, "unable to encode revision"));
      return;
    }
    let revisionSeed = new Uint8Array(
      file.seed.length + encodedRevision.length
    );
    revisionSeed.set(file.seed, 0);
    revisionSeed.set(encodedRevision, file.seed.length);
    let revisionKey = deriveChildSeed(revisionSeed, file.inode);
    let newRevision = file.revision + BigInt(revisionKey[0]) + 1n;

    // Get the encryption key.
    let encryptionKey = deriveChildSeed(file.seed, file.inode);

    // Create a new encrypted blob for the data.
    //
    // NOTE: Need to supply the data that would be in place after a
    // successful update, which means using the new metadata and revision
    // number.
    let [encryptedData, errEFS] = encryptFileSmall(
      encryptionKey,
      file.inode,
      newRevision,
      newMetadata,
      newData,
      newMetadata.largestHistoricSize
    );
    if (errEFS !== null) {
      resolve(addContextToErr(errEFS, "unable to encrypt updated file"));
      return;
    }

    // Upload the data to get the immutable link.
    let skylink;
    try {
      skylink = await upload(encryptedData, {
        Filename: STD_FILENAME,
      });
    } catch (e) {
      resolve(addContextToErr(e, "new data upload failed"));
      return;
    }

    // Write to the registry entry.
    let [entryData, errSTRED] = skylinkToResolverEntryData(skylink);
    if (errSTRED !== null) {
      resolve(
        addContextToErr(
          errSTRED,
          "could not create resolver link from upload skylink"
        )
      );
      return;
    }
    try {
      await overwriteRegistryEntry(
        file.keypair,
        file.dataKey,
        entryData,
        newRevision
      );
    } catch (e: any) {
      resolve(addContextToErr(e, "could not write to registry entry"));
      return;
    }

    // File update was successful, update the file metadata.
    file.revision = newRevision;
    file.metadata = newMetadata;
    file.fileData = newData;
    resolve(null);
  });
}

export {
  createIndependentFileSmall,
  openIndependentFileSmall,
  overwriteIndependentFileSmall,
};
