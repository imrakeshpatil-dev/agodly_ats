import { promises as fs } from "fs";
import path from "path";

import { AppStateSnapshot, AppStateStorePayload } from "../types/app-state";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { runtimeStateService } from "./runtime-state.service";

interface AppStateStoreFile {
  bulkUpload: Record<string, unknown>;
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

  async getSnapshot(candidates: AppStateSnapshot["candidates"]): Promise<AppStateSnapshot> {
    await this.ensureLoaded();

    return {
      bulkUpload: { ...this.state.bulkUpload },
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
    this.state.jobs = mergeRowsByIdentity(payload.jobs, this.state.jobs);
    this.state.interviews = mergeRowsByIdentity(payload.interviews, this.state.interviews);
    this.state.placements = mergeRowsByIdentity(payload.placements, this.state.placements);
    this.state.activities = mergeRowsByIdentity(payload.activities, this.state.activities);

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
    } catch (error) {
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

const mergeRowsByIdentity = (
  rows: unknown,
  fallback: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  if (!Array.isArray(rows)) return fallback.map((item) => ({ ...item }));

  const existing = fallback.map((item) => ({ ...item }));
  const merged = new Map<string, Record<string, unknown>>();
  const order: string[] = [];

  existing.forEach((row, index) => {
    const key = getRowIdentity(row) || `existing:${index}`;
    merged.set(key, row);
    order.push(key);
  });

  rows
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .forEach((item, index) => {
      const incoming = { ...(item as Record<string, unknown>) };
      const key = getRowIdentity(incoming) || `incoming:${Date.now()}:${index}`;
      const current = merged.get(key);

      if (!order.includes(key)) order.push(key);
      merged.set(key, current ? { ...current, ...incoming } : incoming);
    });

  return order.map((key) => merged.get(key)).filter((item): item is Record<string, unknown> => Boolean(item));
};

const getRowIdentity = (row: Record<string, unknown>): string => {
  const id = String(row.id || "").trim();
  if (id) return `id:${id}`;

  const email = String(row.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const name = String(row.name || row.title || "").trim().toLowerCase();
  const createdAt = String(row.createdAt || row.scheduledAt || "").trim();
  if (name && createdAt) return `name-date:${name}:${createdAt}`;

  return "";
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
  users: normalizeRows(parsed.users, []),
  clients: normalizeRows(parsed.clients, []),
  jobs: normalizeRows(parsed.jobs, []),
  interviews: normalizeRows(parsed.interviews, []),
  placements: normalizeRows(parsed.placements, []),
  activities: normalizeRows(parsed.activities, [])
});

export const appStateStoreService = new AppStateStoreService();
