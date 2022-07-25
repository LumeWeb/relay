const esbuild = require("esbuild");
esbuild.buildSync({
  entryPoints: ["build/index.js"],
  outdir: "node-dist",
  platform: "node",
  target: ["node18"],
  bundle: true,
  format: "cjs",
  mainFields: ["main"],
  external: [
    "udx-native",
    "secp256k1",
    "bigint-buffer",
    "bufferutil",
    "sodium-native",
    "loady",
    "bcrypto",
    "bdb",
    "hsd",
    "goosig",
    "mrmr",
    "@pokt-network/amino-js",
    "utf-8-validate",
  ],
  define: {
    "global.GENTLY": false,
  },
});
