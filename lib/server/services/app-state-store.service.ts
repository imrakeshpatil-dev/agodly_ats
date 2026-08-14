import { promises as fs } from "fs";
import path from "path";

import { AppStateSnapshot, AppStateStorePayload } from "../types/app-state";
import { mergeRowsByIdentity } from "../utils/record-merge";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { runtimeStateService } from "./runtime-state.service";

interface AppStateStoreFile {
  bulkUpload: Record<string, unknown>;
  bulkUploadByUser: Record<string, Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  interviews: Array<Record<string, unknown>>;
  placements: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}

class AppStateStoreService {
  private readonly stateKey = "app-state";
  private readonly filePath: string;
  private initialized = false;
  private state: AppStateStoreFile = createDefaultState();

  constructor() {
    this.filePath = resolveRuntimeDataPath("app-state.json");
  }

  async getSnapshot(
    candidates: AppStateSnapshot["candidates"],
    options: { bulkUploadOwnerId?: string } = {}
  ): Promise<AppStateSnapshot> {
    await this.ensureLoaded();

    const ownerId = normalizeOwnerId(options.bulkUploadOwnerId);
    const bulkUpload = ownerId
      ? { ...(this.state.bulkUploadByUser[ownerId] || {}) }
      : mergeBulkUploadSnapshots([this.state.bulkUpload, ...Object.values(this.state.bulkUploadByUser)]);

    return {
      bulkUpload,
      users: this.state.users.map(sanitizeUserForSnapshot),
      candidates: candidates.map((item) => ({ ...item })),
      clients: this.state.clients.map((item) => ({ ...item })),
      jobs: this.state.jobs.map((item) => ({ ...item })),
      interviews: this.state.interviews.map((item) => ({ ...item })),
      placements: this.state.placements.map((item) => ({ ...item })),
      activities: this.state.activities.map((item) => ({ ...item }))
    };
  }

  async getUsers(): Promise<Array<Record<string, unknown>>> {
    await this.ensureLoaded();
    return this.state.users.map((item) => ({ ...item }));
  }

  /**
   * Sets a stored user's password hash in place, preserving every other field.
   * Matches by id first, then by (case-insensitive) email. Returns false when no
   * matching user exists (e.g. the env-based admin, which has no stored record).
   */
  async setUserPassword(
    identifier: { id?: string; email?: string },
    passwordHash: string
  ): Promise<boolean> {
    await this.ensureLoaded();

    const wantedId = String(identifier.id || "").trim();
    const wantedEmail = String(identifier.email || "").trim().toLowerCase();

    const user = this.state.users.find((item) => {
      const id = String(item.id || "").trim();
      const email = String(item.email || "").trim().toLowerCase();
      if (wantedId && id && id === wantedId) return true;
      if (wantedEmail && email && email === wantedEmail) return true;
      return false;
    });

    if (!user) return false;

    user.passwordHash = passwordHash;
    user.passwordSetAt = new Date().toISOString();
    user.authProvider = "password";
    delete user.password; // drop any legacy plaintext password field

    await this.persist();
    return true;
  }

  async updateState(payload: AppStateStorePayload): Promise<void> {
    await this.ensureLoaded();

    if (payload.bulkUpload && typeof payload.bulkUpload === "object" && !Array.isArray(payload.bulkUpload)) {
      this.state.bulkUpload = { ...payload.bulkUpload };
    }

    this.state.users = mergeUserRowsPreservingSecrets(payload.users, this.state.users);
    this.state.clients = mergeRowsByIdentity(payload.clients, this.state.clients);
    this.state.jobs = mergeRowsByIdentity(payload.jobs, this.state.jobs, { preferNewestUpdatedAt: true });
    this.state.interviews = mergeRowsByIdentity(payload.interviews, this.state.interviews);
    this.state.placements = mergeRowsByIdentity(payload.placements, this.state.placements);
    this.state.activities = mergeRowsByIdentity(payload.activities, this.state.activities);

    await this.persist();
  }

  async updateBulkUploadForUser(ownerId: string, bulkUpload: Record<string, unknown>): Promise<void> {
    await this.ensureLoaded();

    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (!normalizedOwnerId) return;

    this.state.bulkUploadByUser[normalizedOwnerId] = normalizeBulkUploadSnapshot(bulkUpload);
    await this.persist();
  }

  async recordBulkUploadForUser(ownerId: string, bulkUpload: Record<string, unknown>): Promise<void> {
    await this.ensureLoaded();

    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (!normalizedOwnerId) return;

    const current = this.state.bulkUploadByUser[normalizedOwnerId] || {};
    const incoming = normalizeBulkUploadSnapshot(bulkUpload);
    this.state.bulkUploadByUser[normalizedOwnerId] = {
      ...current,
      ...incoming,
      results: mergeBulkRows([incoming, current], "results"),
      blockedDuplicates: mergeBulkRows([incoming, current], "blockedDuplicates"),
      duplicates: mergeBulkRows([incoming, current], "duplicates", "duplicateCandidate"),
      candidateNotes: mergeBulkRows([incoming, current], "candidateNotes")
    };
    await this.persist();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await runtimeStateService.get<Partial<AppStateStoreFile>>(this.stateKey);
      if (stored) {
        this.state = normalizeStateFile(stored);
        this.initialized = true;
        return;
      }
    } catch {
      await this.loadLegacyFile();
      this.initialized = true;
      return;
    }

    await this.loadLegacyFile();
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await runtimeStateService.set(this.stateKey, this.state);
  }

  private async loadLegacyFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.state = normalizeStateFile(JSON.parse(raw) as Partial<AppStateStoreFile>);
    } catch {
      this.state = createDefaultState();
    }

    await this.persist();
  }
}

const normalizeRows = (
  rows: unknown,
  fallback: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  if (!Array.isArray(rows)) return fallback.map((item) => ({ ...item }));
  return rows
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ ...(item as Record<string, unknown>) }));
};

const SENSITIVE_USER_FIELDS = new Set(["password", "passwordHash"]);

const sanitizeUserForSnapshot = (user: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  Object.entries(user).forEach(([key, value]) => {
    if (SENSITIVE_USER_FIELDS.has(key)) return;
    sanitized[key] = value;
  });

  sanitized.passwordConfigured = Boolean(user.passwordHash || user.password);
  return sanitized;
};

const mergeUserRowsPreservingSecrets = (
  rows: unknown,
  fallback: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  const normalizedRows = Array.isArray(rows) ? normalizeRows(rows, []) : [];
  const existingByIdOrEmail = new Map<string, Record<string, unknown>>();
  const emittedKeys = new Set<string>();

  fallback.forEach((user) => {
    const id = String(user.id || "").trim();
    const email = String(user.email || "").trim().toLowerCase();
    if (id) existingByIdOrEmail.set(`id:${id}`, user);
    if (email) existingByIdOrEmail.set(`email:${email}`, user);
  });

  const mergedUsers = normalizedRows.map((user) => {
    const id = String(user.id || "").trim();
    const email = String(user.email || "").trim().toLowerCase();
    const existing =
      (id ? existingByIdOrEmail.get(`id:${id}`) : undefined) ||
      (email ? existingByIdOrEmail.get(`email:${email}`) : undefined);
    const merged = { ...user };
    if (id) emittedKeys.add(`id:${id}`);
    if (email) emittedKeys.add(`email:${email}`);

    if (!merged.passwordHash && existing?.passwordHash) {
      merged.passwordHash = existing.passwordHash;
    }
    if (!merged.password && existing?.password) {
      merged.password = existing.password;
    }
    if (!merged.passwordSetAt && existing?.passwordSetAt) {
      merged.passwordSetAt = existing.passwordSetAt;
    }
    if (!merged.authProvider && existing?.authProvider) {
      merged.authProvider = existing.authProvider;
    }

    return merged;
  });

  fallback.forEach((user) => {
    const id = String(user.id || "").trim();
    const email = String(user.email || "").trim().toLowerCase();
    const alreadyEmitted = (id && emittedKeys.has(`id:${id}`)) || (email && emittedKeys.has(`email:${email}`));
    if (!alreadyEmitted) mergedUsers.push({ ...user });
  });

  return mergedUsers;
};

const createDefaultState = (): AppStateStoreFile => ({
  bulkUpload: {},
  bulkUploadByUser: {},
  users: [],
  clients: [],
  jobs: [],
  interviews: [],
  placements: [],
  activities: []
});

const normalizeStateFile = (parsed: Partial<AppStateStoreFile>): AppStateStoreFile => ({
  bulkUpload:
    parsed.bulkUpload && typeof parsed.bulkUpload === "object" && !Array.isArray(parsed.bulkUpload)
      ? { ...parsed.bulkUpload }
      : {},
  bulkUploadByUser: normalizeBulkUploadByUser(parsed.bulkUploadByUser),
  users: normalizeRows(parsed.users, []),
  clients: normalizeRows(parsed.clients, []),
  jobs: normalizeRows(parsed.jobs, []),
  interviews: normalizeRows(parsed.interviews, []),
  placements: normalizeRows(parsed.placements, []),
  activities: normalizeRows(parsed.activities, [])
});

const normalizeOwnerId = (value: unknown): string => String(value || "").trim().toLowerCase();

const normalizeBulkUploadByUser = (value: unknown): Record<string, Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, Record<string, unknown>>>(
    (normalized, [ownerId, snapshot]) => {
      const key = normalizeOwnerId(ownerId);
      if (!key || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return normalized;
      normalized[key] = normalizeBulkUploadSnapshot(snapshot as Record<string, unknown>);
      return normalized;
    },
    {}
  );
};

const normalizeBulkUploadSnapshot = (value: Record<string, unknown>): Record<string, unknown> => ({
  ...value,
  results: normalizeRows(value.results, []).slice(0, 120),
  blockedDuplicates: normalizeRows(value.blockedDuplicates, []).slice(0, 120),
  duplicates: normalizeRows(value.duplicates, []).slice(0, 120),
  candidateNotes: normalizeRows(value.candidateNotes, []).slice(0, 120)
});

export const mergeBulkUploadSnapshots = (
  snapshots: Array<Record<string, unknown>>
): Record<string, unknown> => {
  const valid = snapshots.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  if (!valid.length) return {};
  if (valid.length === 1) return normalizeBulkUploadSnapshot(valid[0]);

  return {
    totalFiles: sumBulkMetric(valid, "totalFiles"),
    pending: sumBulkMetric(valid, "pending"),
    completed: sumBulkMetric(valid, "completed"),
    failed: sumBulkMetric(valid, "failed"),
    blockedCount: sumBulkMetric(valid, "blockedCount"),
    lastRunAt: valid.map((item) => String(item.lastRunAt || "")).sort().at(-1) || "",
    results: mergeBulkRows(valid, "results"),
    blockedDuplicates: mergeBulkRows(valid, "blockedDuplicates"),
    duplicates: mergeBulkRows(valid, "duplicates", "duplicateCandidate"),
    candidateNotes: mergeBulkRows(valid, "candidateNotes")
  };
};

const sumBulkMetric = (snapshots: Array<Record<string, unknown>>, field: string): number =>
  snapshots.reduce((total, snapshot) => total + Math.max(0, Number(snapshot[field] || 0)), 0);

const mergeBulkRows = (
  snapshots: Array<Record<string, unknown>>,
  field: string,
  nestedIdentityField = ""
): Array<Record<string, unknown>> => {
  const rows = snapshots.flatMap((snapshot) => normalizeRows(snapshot[field], []));
  const seen = new Set<string>();

  return rows
    .filter((row) => {
      const identitySource = nestedIdentityField && row[nestedIdentityField] && typeof row[nestedIdentityField] === "object"
        ? row[nestedIdentityField] as Record<string, unknown>
        : row;
      const identity = String(
        identitySource.id || identitySource.email || identitySource.phone || `${identitySource.fileName || ""}:${identitySource.message || ""}`
      ).trim().toLowerCase();
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .slice(0, 120);
};

export const appStateStoreService = new AppStateStoreService();
