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
    "sodium-native",
    "loady",
    "bcrypto",
  ],
  define: {
    "global.GENTLY": false,
  },
});
