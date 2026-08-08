import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 does NOT auto-load .env when a prisma.config.ts is present, so the
// CLI (migrate deploy / generate) would otherwise ignore DATABASE_URL from .env
// and migrate a different SQLite file than the running app connects to.
dotenv.config();

process.env.DATABASE_URL ||= `file:${path.resolve(process.cwd(), "data", "agodly-ats.sqlite")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
