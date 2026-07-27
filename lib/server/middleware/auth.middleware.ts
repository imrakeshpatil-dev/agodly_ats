import type { Request } from "express";

import { AuthSession, AuthUser } from "../services/auth.service";

// Auth context attached to a request by the Next.js shim (lib/server/http.ts)
// after verifying the bearer token. Controllers read `authUser` / `authSession`.
// Extends the Express Request type so existing controller casts remain valid;
// `express` is a type-only dev dependency (no runtime Express in this app).
export interface AuthenticatedRequest extends Request {
  authSession: AuthSession;
  authUser: AuthUser;
}

export const extractBearerToken = (header: string | undefined): string => {
  const raw = String(header || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
};
