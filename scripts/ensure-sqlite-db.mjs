import { mkdir, open } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

const dataDir = String(process.env.AGODLY_DATA_DIR || "").trim() || path.resolve(process.cwd(), "data");
const databaseUrl = String(process.env.DATABASE_URL || `file:${path.join(dataDir, "agodly-ats.sqlite")}`).trim();

if (!databaseUrl.startsWith("file:")) {
  console.log("Database initialization skipped: the configured database is not SQLite.");
  process.exit(0);
}

const rawPath = databaseUrl.slice("file:".length).split("?", 1)[0];
if (!rawPath || rawPath === ":memory:") {
  console.log("Database initialization skipped: SQLite is running in memory.");
  process.exit(0);
}

const sqlitePath = path.resolve(decodeURIComponent(rawPath));
await mkdir(path.dirname(sqlitePath), { recursive: true });
const databaseFile = await open(sqlitePath, "a", 0o600);
await databaseFile.close();
console.log(`SQLite database ready: ${sqlitePath}`);
