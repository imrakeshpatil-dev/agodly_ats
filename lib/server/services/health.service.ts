import { promises as fs } from "fs";
import crypto from "node:crypto";
import path from "path";

import { env, getConfigIssues } from "../config/env";
import { prisma } from "./prisma.service";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { AIHealthResult } from "./ai/aiProvider";
import { getAIProvider } from "./ai/aiProviderFactory";
import { appStateStoreService } from "./app-state-store.service";
import { candidateStoreService } from "./candidate-store.service";

export interface HealthStatus {
  success: true;
  message: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface ReadinessStatus {
  success: boolean;
  status: "ready" | "degraded";
  timestamp: string;
  checks: {
    configuration: {
      ok: boolean;
      issues: string[];
    };
    database: {
      ok: boolean;
      provider: string;
      durable: boolean;
      environment: string;
      error?: string;
    };
    runtimeStorage: {
      ok: boolean;
      path: string;
      durable: boolean;
      error?: string;
    };
  };
}

export interface DiagnosticsStatus extends ReadinessStatus {
  diagnostics: {
    migrationVersion: string;
    tables: {
      candidates: TableDiagnostic;
      jobs: TableDiagnostic;
      clients: TableDiagnostic;
      submissions: TableDiagnostic;
    };
    counts: {
      candidates: number | null;
      jobs: number | null;
      clients: number | null;
      activities: number | null;
    };
    latestRecordCreated: string | null;
    latestSuccessfulWrite: string | null;
    latestFailedWrite: string | null;
    lastBackupStatus: string;
    storageStatus: string;
    applicationVersion: string;
    ai: AIHealthResult;
  };
}

interface TableDiagnostic {
  readable: boolean;
  error?: string;
}

export const getHealthStatus = (environment: string): HealthStatus => ({
  success: true,
  message: "Agodly ATS backend is running",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  environment
});

export const getReadinessStatus = async (): Promise<ReadinessStatus> => {
  const configIssues = getConfigIssues();
  const runtimeStorage = await checkRuntimeStorage();
  const database = await checkDatabaseStatus();
  const isBlockingConfigIssue = env.isProduction
    ? configIssues.some((issue) => issue.includes("Production") || issue.includes("ADMIN_PASSWORD") || issue.includes("CORS_ORIGIN"))
    : false;

  const durabilityOk = env.isProduction ? database.durable && runtimeStorage.durable : true;
  const success = !isBlockingConfigIssue && runtimeStorage.ok && database.ok && durabilityOk;

  return {
    success,
    status: success ? "ready" : "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      configuration: {
        ok: !isBlockingConfigIssue,
        issues: configIssues
      },
      database,
      runtimeStorage
    }
  };
};

export const getDiagnosticsStatus = async (): Promise<DiagnosticsStatus> => {
  const readiness = await getReadinessStatus();
  const [candidateDiag, jobDiag, clientDiag, activityDiag, runtimeDataDiag, lastBackupStatus, ai] = await Promise.all([
    readTable(() => prisma.candidate.count()),
    readTable(() => prisma.job.count()),
    readTable(() => prisma.client.count()),
    readTable(() => prisma.activity.count()),
    readRuntimeApplicationData(),
    getLastBackupStatus(),
    getAIProvider().healthCheck()
  ]);

  const latestCandidate = await safeLatest(() =>
    prisma.candidate.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  );
  const latestJob = await safeLatest(() =>
    prisma.job.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  );
  const latestClient = await safeLatest(() =>
    prisma.client.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  );
  const latestRuntimeWrite = await safeLatest(() =>
    prisma.runtimeState.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    })
  );

  return {
    ...readiness,
    diagnostics: {
      migrationVersion: await getMigrationVersion(),
      tables: {
        candidates: toTableDiagnostic(candidateDiag),
        jobs: toTableDiagnostic(jobDiag),
        clients: toTableDiagnostic(clientDiag),
        submissions: {
          readable: activityDiag.ok,
          ...(activityDiag.error ? { error: activityDiag.error } : {})
        }
      },
      counts: {
        candidates: runtimeDataDiag.counts?.candidates ?? null,
        jobs: runtimeDataDiag.counts?.jobs ?? null,
        clients: runtimeDataDiag.counts?.clients ?? null,
        activities: runtimeDataDiag.counts?.activities ?? null
      },
      latestRecordCreated:
        runtimeDataDiag.latestRecordCreated ??
        newestIso([latestCandidate?.createdAt, latestJob?.createdAt, latestClient?.createdAt]),
      latestSuccessfulWrite: latestRuntimeWrite?.updatedAt ? latestRuntimeWrite.updatedAt.toISOString() : null,
      latestFailedWrite: null,
      lastBackupStatus,
      storageStatus: readiness.checks.database.durable ? "durable_database" : "non_durable_storage",
      applicationVersion: "1.0.0",
      ai
    }
  };
};

const getLastBackupStatus = async (): Promise<string> => {
  try {
    const rawStatus = await fs.readFile(resolveRuntimeDataPath("backup-status.json"), "utf8");
    const backup = JSON.parse(rawStatus) as { status?: string; timestamp?: string; file?: string };
    if (backup.status !== "successful" || !backup.timestamp) return "invalid_backup_status";
    const backupTime = Date.parse(backup.timestamp);
    if (!Number.isFinite(backupTime)) return "invalid_backup_timestamp";
    const ageHours = Math.max(0, (Date.now() - backupTime) / (60 * 60 * 1000));
    const freshness = ageHours <= 24 ? "healthy" : "stale";
    return `${freshness} · ${backup.timestamp}${backup.file ? ` · ${backup.file}` : ""}`;
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    return errorCode === "ENOENT" ? "not_configured" : "backup_status_unreadable";
  }
};

const checkRuntimeStorage = async (): Promise<ReadinessStatus["checks"]["runtimeStorage"]> => {
  const storagePath = resolveRuntimeDataPath(`.readiness-check-${process.pid}-${crypto.randomUUID()}`);
  try {
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, new Date().toISOString(), "utf8");
    await fs.unlink(storagePath);
    return {
      ok: true,
      path: path.dirname(storagePath),
      durable: !isEphemeralFsPath(path.dirname(storagePath))
    };
  } catch (error) {
    return {
      ok: false,
      path: path.dirname(storagePath),
      durable: false,
      error: error instanceof Error ? error.message : "Runtime storage check failed"
    };
  }
};

const checkDatabaseStatus = async (): Promise<ReadinessStatus["checks"]["database"]> => {
  const provider = inferDatabaseProvider();
  const durable = isDatabaseDurable(provider, env.databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.runtimeState.count();
    return {
      ok: true,
      provider,
      durable,
      environment: env.nodeEnv
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      durable,
      environment: env.nodeEnv,
      error: error instanceof Error ? error.message : "Database health check failed"
    };
  }
};

const readRuntimeApplicationData = async (): Promise<{
  counts?: DiagnosticsStatus["diagnostics"]["counts"];
  latestRecordCreated?: string | null;
  error?: string;
}> => {
  try {
    const candidates = await candidateStoreService.getActiveCandidates();
    const snapshot = await appStateStoreService.getSnapshot(candidates);
    return {
      counts: {
        candidates: candidates.length,
        jobs: snapshot.jobs.length,
        clients: snapshot.clients.length,
        activities: snapshot.activities.length
      },
      latestRecordCreated: newestIsoValues([
        ...candidates.map((candidate) => candidate.createdAt),
        ...snapshot.jobs.map((job) => job.createdAt),
        ...snapshot.clients.map((client) => client.createdAt)
      ])
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Runtime application data read failed"
    };
  }
};

const inferDatabaseProvider = (): string => {
  if (env.databaseUrl.startsWith("postgresql://") || env.databaseUrl.startsWith("postgres://")) return "postgresql";
  if (env.databaseUrl.startsWith("file:")) return "sqlite";
  return "unknown";
};

// A path is non-durable when it lives under a temp/ephemeral directory that is
// wiped between deployments (serverless /tmp, /var/tmp, or an OS temp folder).
const isEphemeralFsPath = (fsPath: string): boolean => {
  const normalized = fsPath.replace(/\\/g, "/").toLowerCase();
  return /(^|\/)(var\/)?tmp(\/|$)/.test(normalized) || /\/temp(\/|$)/.test(normalized);
};

// SQLite is durable only when its file sits on a persistent disk; managed
// PostgreSQL is always durable. Anything else is treated as non-durable.
const isDatabaseDurable = (provider: string, databaseUrl: string): boolean => {
  if (provider === "postgresql") return true;
  if (provider === "sqlite") {
    const sqlitePath = databaseUrl.slice("file:".length);
    if (!sqlitePath || sqlitePath === ":memory:") return false;
    return !isEphemeralFsPath(sqlitePath);
  }
  return false;
};

const readTable = async (read: () => Promise<number>): Promise<{ ok: boolean; count: number | null; error?: string }> => {
  try {
    return { ok: true, count: await read() };
  } catch (error) {
    return {
      ok: false,
      count: null,
      error: error instanceof Error ? error.message : "Table read failed"
    };
  }
};

const toTableDiagnostic = (diag: { ok: boolean; error?: string }): TableDiagnostic => ({
  readable: diag.ok,
  ...(diag.error ? { error: diag.error } : {})
});

const safeLatest = async <T>(read: () => Promise<T | null>): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};

const newestIso = (values: Array<Date | null | undefined>): string | null => {
  const dates = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime())
    .filter((value) => Number.isFinite(value));
  if (!dates.length) return null;
  return new Date(Math.max(...dates)).toISOString();
};

const newestIsoValues = (values: unknown[]): string | null => {
  const timestamps = values
    .map((value) => Date.parse(String(value || "")))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

const getMigrationVersion = async (): Promise<string> => {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name?: string; finished_at?: Date }>>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1
    `;
    return rows[0]?.migration_name || "not_available";
  } catch {
    return "not_available";
  }
};
