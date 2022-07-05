import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "lumerelay.env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const RELAY_PORT = process.env.RELAY_PORT ?? 8080;
export const RELAY_DOMAIN = process.env.RELAY_DOMAIN;
export const AFRAID_USERNAME = process.env.AFRAID_USERNAME;
export const AFRAID_PASSWORD = process.env.AFRAID_PASSWORD;
export const RELAY_SEED = process.env.RELAY_SEED;
export const POCKET_APP_ID = process.env.POCKET_APP_ID || false;
export const POCKET_APP_KEY = process.env.POCKET_APP_KEY || false;
export const POCKET_ACCOUNT_PUBLIC_KEY =
  process.env.POCKET_ACCOUNT_PUBLIC_KEY || false;
export const POCKET_ACCOUNT_PRIVATE_KEY =
  process.env.POCKET_ACCOUNT_PRIVATE_KEY || false;

export const HSD_USE_EXTERNAL_NODE = process.env.HSD_USE_EXTERNAL_NODE || false;
export const HSD_NETWORK_TYPE = process.env.HSD_NETWORK || "main";
export const HSD_HOST = process.env.HSD_HOST || "localhost";
export const HSD_PORT = Number(process.env.HSD_PORT) || 12037;
export const HSD_API_KEY = process.env.HSD_API_KEY || "foo";

export const POCKET_HOST = process.env.POCKET_HOST || "localhost";
export const POCKET_PORT = process.env.POCKET_PORT || 8081;
