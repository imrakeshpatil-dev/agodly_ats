import crypto from "crypto";

import { env } from "../config/env";
import { logger } from "../utils/logger";
import { hashPassword, timingSafeEqualStrings, verifyPassword } from "../utils/password";
import { appStateStoreService } from "./app-state-store.service";
import { runtimeStateService } from "./runtime-state.service";

export type AuthRole = "CEO" | "Managing Director" | "Admin" | "TA Manager" | "Recruiter" | "Viewer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  createdAt: string;
}

interface SignedAuthPayload {
  jti: string;
  user: AuthUser;
  createdAt: string;
  expiresAt: string;
}

export const founderRoles = new Set<AuthRole>(["CEO", "Managing Director", "Admin"]);

export const isFounderRole = (role: string | undefined): boolean => {
  return founderRoles.has(normalizeAuthRole(role));
};

const COMPANY_EMAIL_DOMAIN = "@agodly.com";
const SIGNED_TOKEN_VERSION = "v1";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVOKED_TOKENS_KEY = "auth-revoked-tokens";
const DEV_SIGNING_SECRET = "agodly-ats-local-dev-secret";

class AuthService {
  // jti -> token expiry (ms). Durable revocation list, mirrored in the database
  // so logouts survive restarts. Single-instance SQLite makes this authoritative.
  private revokedTokens = new Map<string, number>();
  private revocationLoaded = false;

  /** Load the persisted revocation list at startup so getSession stays synchronous. */
  async loadRevokedTokens(): Promise<void> {
    try {
      const stored = await runtimeStateService.get<Record<string, number>>(REVOKED_TOKENS_KEY);
      const now = Date.now();
      this.revokedTokens.clear();
      if (stored) {
        for (const [jti, expiresAt] of Object.entries(stored)) {
          if (Number.isFinite(expiresAt) && expiresAt > now) {
            this.revokedTokens.set(jti, expiresAt);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to load revoked auth tokens", {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.revocationLoaded = true;
    }
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");

    const adminUser = this.tryAdminLogin(normalizedEmail, normalizedPassword);
    if (adminUser) {
      return this.createSession(adminUser);
    }

    const stateUser = await this.findPasswordUser(normalizedEmail, normalizedPassword);
    if (stateUser) {
      return this.createSession(stateUser);
    }

    return null;
  }

  getSession(token: string): AuthSession | null {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return null;
    return this.verifySignedSession(cleanToken);
  }

  async logout(token: string): Promise<void> {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return;

    const payload = this.decodeSignedPayload(cleanToken);
    if (!payload?.jti) return;

    const expiresAt = Date.parse(payload.expiresAt);
    this.revokedTokens.set(payload.jti, Number.isFinite(expiresAt) ? expiresAt : Date.now() + SESSION_TTL_MS);
    await this.persistRevokedTokens();
  }

  private tryAdminLogin(normalizedEmail: string, normalizedPassword: string): AuthUser | null {
    const adminEmail = String(env.adminEmail || "").trim().toLowerCase();
    const adminPassword = String(env.adminPassword || "");

    if (!adminEmail || !adminPassword) return null;
    if (!timingSafeEqualStrings(normalizedEmail, adminEmail)) return null;
    if (!timingSafeEqualStrings(normalizedPassword, adminPassword)) return null;

    return {
      id: "usr-admin",
      name: "Admin User",
      email: adminEmail,
      role: "Managing Director"
    };
  }

  private createSession(user: AuthUser): { token: string; user: AuthUser } {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const token = this.createSignedToken({
      jti: crypto.randomUUID(),
      user,
      createdAt,
      expiresAt
    });

    return { token, user };
  }

  private createSignedToken(payload: SignedAuthPayload): string {
    const encodedPayload = this.encodeBase64Url(JSON.stringify(payload));
    const signature = this.signPayload(encodedPayload);
    return `${SIGNED_TOKEN_VERSION}.${encodedPayload}.${signature}`;
  }

  private decodeSignedPayload(token: string): SignedAuthPayload | null {
    const [version, encodedPayload, signature] = token.split(".");
    if (version !== SIGNED_TOKEN_VERSION || !encodedPayload || !signature) return null;

    const expectedSignature = this.signPayload(encodedPayload);
    if (!this.safeEqual(signature, expectedSignature)) return null;

    try {
      return JSON.parse(this.decodeBase64Url(encodedPayload)) as SignedAuthPayload;
    } catch {
      return null;
    }
  }

  private verifySignedSession(token: string): AuthSession | null {
    const payload = this.decodeSignedPayload(token);
    if (!payload || !payload.user || !payload.createdAt || !payload.expiresAt || !payload.jti) return null;

    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

    if (this.revokedTokens.has(payload.jti)) return null;

    const user = this.normalizeSignedUser(payload.user);
    if (!user) return null;

    return {
      token,
      user,
      createdAt: payload.createdAt
    };
  }

  private normalizeSignedUser(user: Partial<AuthUser>): AuthUser | null {
    const email = String(user.email || "").trim().toLowerCase();
    const id = String(user.id || email).trim();
    if (!email || !id) return null;

    return {
      id,
      name: String(user.name || email.split("@")[0]),
      email,
      role: normalizeAuthRole(user.role)
    };
  }

  private signPayload(encodedPayload: string): string {
    return crypto.createHmac("sha256", this.getSigningSecret()).update(encodedPayload).digest("base64url");
  }

  private getSigningSecret(): string {
    if (env.authTokenSecret) return env.authTokenSecret;
    if (env.isProduction) {
      // Should be unreachable: startup fails fast when this is missing in production.
      throw new Error("AUTH_TOKEN_SECRET is not configured");
    }
    return DEV_SIGNING_SECRET;
  }

  private safeEqual(left: string, right: string): boolean {
    return timingSafeEqualStrings(left, right);
  }

  private encodeBase64Url(value: string): string {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private decodeBase64Url(value: string): string {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private async persistRevokedTokens(): Promise<void> {
    const now = Date.now();
    const record: Record<string, number> = {};
    for (const [jti, expiresAt] of this.revokedTokens.entries()) {
      if (expiresAt > now) {
        record[jti] = expiresAt;
      } else {
        this.revokedTokens.delete(jti);
      }
    }

    try {
      await runtimeStateService.set(REVOKED_TOKENS_KEY, record);
    } catch (error) {
      logger.error("Failed to persist revoked auth tokens", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /** Hash and store a stored user's password server-side. Returns false if not found. */
  async setUserPassword(identifier: { id?: string; email?: string }, newPassword: string): Promise<boolean> {
    return appStateStoreService.setUserPassword(identifier, hashPassword(newPassword));
  }

  private async findPasswordUser(email: string, password: string): Promise<AuthUser | null> {
    if (!email.endsWith(COMPANY_EMAIL_DOMAIN)) return null;

    const users = await appStateStoreService.getUsers();
    const record = users.find((item) => String(item.email || "").trim().toLowerCase() === email);
    if (!record) return null;

    const status = String(record.status || "Active").trim().toLowerCase();
    if (status !== "active") return null;

    const storedHash = String(record.passwordHash || "").trim();
    if (!storedHash) return null;

    const { valid, needsUpgrade } = verifyPassword(password, storedHash);
    if (!valid) return null;

    if (needsUpgrade) {
      // We have the plaintext at login, so transparently migrate legacy SHA-256
      // hashes to scrypt. Best-effort: never block a valid login on a write error.
      try {
        await this.setUserPassword({ id: String(record.id || ""), email }, password);
      } catch (error) {
        logger.warn("Failed to upgrade legacy password hash", {
          email,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      id: String(record.id || email),
      name: String(record.name || email.split("@")[0]),
      email,
      role: normalizeAuthRole(String(record.role || "Recruiter"))
    };
  }
}

const normalizeAuthRole = (role: string | undefined): AuthRole => {
  const normalized = String(role || "Recruiter").trim();
  if (normalized === "CEO") return "CEO";
  if (normalized === "MD" || normalized === "Managing Director") return "Managing Director";
  if (normalized === "Admin") return "Admin";
  if (normalized === "TA Manager") return "TA Manager";
  if (normalized === "Viewer") return "Viewer";
  return "Recruiter";
};

export const authService = new AuthService();
