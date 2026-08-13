import { access, mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const requireExisting = process.argv.includes("--require-existing");
const dataDir = String(process.env.AGODLY_DATA_DIR || "").trim() || path.resolve(process.cwd(), "data");
const databaseUrl = String(process.env.DATABASE_URL || `file:${path.join(dataDir, "agodly-ats.sqlite")}`).trim();

if (!databaseUrl.startsWith("file:")) {
  console.log("SQLite backup skipped: the configured database is not SQLite.");
  process.exit(0);
}

const rawPath = databaseUrl.slice("file:".length).split("?", 1)[0];
if (!rawPath || rawPath === ":memory:") {
  throw new Error("A durable SQLite database is required for backups.");
}

const sqlitePath = path.resolve(decodeURIComponent(rawPath));
try {
  await access(sqlitePath);
} catch {
  if (requireExisting) {
    throw new Error(`Production database was not found at ${sqlitePath}. Deployment stopped before migration.`);
  }
  console.log(`SQLite backup skipped: no database exists yet at ${sqlitePath}.`);
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(
  String(process.env.AGODLY_BACKUP_DIR || "").trim() || path.join(path.dirname(sqlitePath), "backups")
);
const backupName = `agodly-ats-${timestamp}.sqlite`;
const backupPath = path.join(backupDir, backupName);
await mkdir(backupDir, { recursive: true });

const source = new Database(sqlitePath, { readonly: true, fileMustExist: true });
try {
  await source.backup(backupPath);
} finally {
  source.close();
}

const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
let integrityResult;
try {
  integrityResult = backup.pragma("integrity_check", { simple: true });
} finally {
  backup.close();
}

if (integrityResult !== "ok") {
  await unlink(backupPath).catch(() => undefined);
  throw new Error(`Backup integrity check failed: ${String(integrityResult)}`);
}

const backupStats = await stat(backupPath);
const statusPath = path.join(dataDir, "backup-status.json");
const temporaryStatusPath = `${statusPath}.tmp`;
await mkdir(path.dirname(statusPath), { recursive: true });
await writeFile(
  temporaryStatusPath,
  `${JSON.stringify(
    {
      status: "successful",
      timestamp: new Date().toISOString(),
      file: backupName,
      sizeBytes: backupStats.size
    },
    null,
    2
  )}\n`,
  { encoding: "utf8", mode: 0o600 }
);
await rename(temporaryStatusPath, statusPath);

const retention = Math.max(2, Number.parseInt(process.env.AGODLY_BACKUP_RETENTION || "10", 10) || 10);
const backupFiles = (await readdir(backupDir))
  .filter((name) => /^agodly-ats-.*\.sqlite$/.test(name))
  .sort()
  .reverse();
for (const staleBackup of backupFiles.slice(retention)) {
  await unlink(path.join(backupDir, staleBackup));
}

console.log(`Verified SQLite backup created: ${backupPath} (${backupStats.size} bytes)`);
