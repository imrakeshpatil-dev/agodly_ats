import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { env } from "../config/env";

const ensureSqliteDirectory = (databaseUrl: string): void => {
  if (!databaseUrl.startsWith("file:")) return;

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath === ":memory:") return;

  const sqlitePath = path.resolve(rawPath);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
};

ensureSqliteDirectory(env.databaseUrl);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: env.databaseUrl }),
    log: env.isProduction ? ["error"] : ["error", "warn"]
  });

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
