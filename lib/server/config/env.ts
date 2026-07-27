import dotenv from "dotenv";

import { resolveRuntimeDataPath } from "../utils/runtime-data";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
// SQLite file store. The database is durable as long as the resolved path lives
// on a persistent disk (VPS filesystem or a mounted volume) — never /tmp or an
// ephemeral serverless filesystem. Override the location with DATABASE_URL or
// AGODLY_DATA_DIR in production.
const defaultDatabaseUrl = `file:${resolveRuntimeDataPath("agodly-ats.sqlite")}`;
process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl;

export const env = {
  nodeEnv,
  isProduction,
  port: toNumber(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@agodly.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? "",
  searchApiKey: process.env.SEARCH_API_KEY ?? "",
  searchApiUrl: process.env.SEARCH_API_URL ?? "https://api.tavily.com/search",
  dataDir: process.env.AGODLY_DATA_DIR ?? "",
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "2mb",
  rateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, isProduction ? 300 : 1000)
};

export const getConfigIssues = (): string[] => {
  const issues: string[] = [];

  if (env.isProduction && env.corsOrigin === "*") {
    issues.push("CORS_ORIGIN should be set to the deployed frontend origin in production.");
  }

  if (env.isProduction && !env.adminPassword) {
    issues.push("ADMIN_PASSWORD must be configured in production.");
  }

  if (env.isProduction && env.adminPassword.length < 12) {
    issues.push("ADMIN_PASSWORD should be at least 12 characters in production.");
  }

  if (env.isProduction && !env.authTokenSecret) {
    issues.push("AUTH_TOKEN_SECRET must be configured in production to sign session tokens.");
  }

  if (env.isProduction && env.authTokenSecret && env.authTokenSecret.length < 32) {
    issues.push("AUTH_TOKEN_SECRET should be at least 32 characters (use a random secret).");
  }

  if (env.isProduction && env.databaseUrl.startsWith("file:")) {
    const sqlitePath = env.databaseUrl.slice("file:".length).replace(/\\/g, "/");
    const onEphemeralPath = /(^|\/)tmp(\/|$)/i.test(sqlitePath) || /\/(var\/)?tmp\//i.test(sqlitePath);
    if (onEphemeralPath) {
      issues.push(
        "Production SQLite DATABASE_URL resolves under a temp directory and will be wiped on redeploy. Point it at a persistent disk or mounted volume (e.g. file:/var/lib/agodly-ats/agodly-ats.sqlite)."
      );
    }
  }

  if (
    !env.databaseUrl.startsWith("file:") &&
    !env.databaseUrl.startsWith("postgresql://") &&
    !env.databaseUrl.startsWith("postgres://")
  ) {
    issues.push("DATABASE_URL must be a SQLite file: path or a PostgreSQL connection string.");
  }

  if (!env.openAiApiKey) {
    issues.push("OPENAI_API_KEY is not configured; AI parsing and LLM match scoring will use fallback behavior.");
  }

  return issues;
};

/**
 * Security-critical misconfigurations that must prevent the server from starting
 * in production. Unlike getConfigIssues (soft warnings surfaced by /ready), these
 * represent states where continuing would be unsafe (e.g. forgeable session tokens).
 */
export const getFatalConfigErrors = (): string[] => {
  if (!env.isProduction) return [];

  const errors: string[] = [];

  if (!env.authTokenSecret || env.authTokenSecret.length < 32) {
    errors.push("AUTH_TOKEN_SECRET must be set to a random value of at least 32 characters in production.");
  }

  if (!env.adminPassword) {
    errors.push("ADMIN_PASSWORD must be configured in production.");
  }

  return errors;
};
