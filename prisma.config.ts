import path from "node:path";

import { defineConfig, env } from "prisma/config";

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
