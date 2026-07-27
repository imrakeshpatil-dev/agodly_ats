import { readFile } from "node:fs/promises";

import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { NextResponse } from "next/server";

import { AppError } from "./middleware/error.middleware";
import { extractBearerToken } from "./middleware/auth.middleware";
import { AuthSession, AuthUser, authService, isFounderRole } from "./services/auth.service";
import { logger } from "./utils/logger";

// A file parsed from multipart/form-data, shaped to match the subset of
// Express.Multer.File that the controllers/services use.
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface ShimRequest {
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string | undefined>;
  file?: UploadedFile;
  files?: UploadedFile[];
  authUser?: AuthUser;
  authSession?: AuthSession;
}

type ShimResult =
  | { kind: "json"; status: number; body: unknown }
  | { kind: "send"; status: number; body: Buffer | string; headers: Record<string, string> }
  | { kind: "download"; path: string; filename: string };

// Minimal Express-Response-compatible sink. Controllers call
// res.status().json() / res.send() / res.setHeader() / res.download().
class ShimResponse {
  private currentStatus = 200;
  private outHeaders: Record<string, string> = {};
  result: ShimResult | null = null;

  status(code: number): this {
    this.currentStatus = code;
    return this;
  }

  setHeader(key: string, value: string): this {
    this.outHeaders[key] = value;
    return this;
  }

  json(body: unknown): this {
    this.result = { kind: "json", status: this.currentStatus, body };
    return this;
  }

  send(body: Buffer | string): this {
    this.result = { kind: "send", status: this.currentStatus, body, headers: this.outHeaders };
    return this;
  }

  download(path: string, filename: string): this {
    this.result = { kind: "download", path, filename };
    return this;
  }
}

export type Controller = (req: ExpressRequest, res: ExpressResponse) => Promise<void> | void;

export interface HandleOptions {
  /** Require a valid bearer token; attaches authUser/authSession. */
  auth?: boolean;
  /** Require a founder role (CEO / Managing Director / Admin). Implies auth. */
  founder?: boolean;
}

type RouteContext = { params?: Record<string, string> | Promise<Record<string, string>> };

// `context` is typed loosely because Next.js generates a distinct RouteContext
// per route (static vs dynamic) and validates the exported handler against it;
// a single generic wrapper must accept all of them.
export const handle =
  (controller: Controller, options: HandleOptions = {}) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (request: Request, context: any = {}): Promise<Response> => {
    try {
      const req = await buildRequest(request, (context ?? {}) as RouteContext);

      if (options.auth || options.founder) {
        const token = extractBearerToken(request.headers.get("authorization") ?? undefined);
        const session = token ? authService.getSession(token) : null;
        if (!session) {
          return errorResponse(new AppError("Unauthorized", 401));
        }
        req.authUser = session.user;
        req.authSession = session;

        if (options.founder && !isFounderRole(session.user.role)) {
          return errorResponse(
            new AppError("Founder access required. Only CEO, Managing Director, or Admin can access this operation.", 403)
          );
        }
      }

      const res = new ShimResponse();
      await controller(req as unknown as ExpressRequest, res as unknown as ExpressResponse);
      return await toResponse(res);
    } catch (error) {
      return errorResponse(error);
    }
  };

const buildRequest = async (request: Request, context: RouteContext): Promise<ShimRequest> => {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const params = context.params ? await context.params : {};

  const shim: ShimRequest = {
    body: {},
    query,
    params: params ?? {},
    headers
  };

  if (request.method === "GET" || request.method === "HEAD") {
    return shim;
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    shim.body = await request.json().catch(() => ({}));
  } else if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files: UploadedFile[] = [];
    const fields: Record<string, unknown> = {};

    for (const [key, value] of form.entries()) {
      if (typeof value === "object" && value !== null && "arrayBuffer" in value) {
        const file = value as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        files.push({
          fieldname: key,
          originalname: file.name,
          mimetype: file.type,
          size: buffer.length,
          buffer
        });
      } else {
        fields[key] = value;
      }
    }

    shim.body = fields;
    shim.files = files;
    shim.file = files[0];
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const fields: Record<string, unknown> = {};
    form.forEach((value, key) => {
      fields[key] = value;
    });
    shim.body = fields;
  }

  return shim;
};

const toResponse = async (res: ShimResponse): Promise<Response> => {
  const result = res.result;
  if (!result) {
    return NextResponse.json({ success: true }, { status: 204 });
  }

  if (result.kind === "json") {
    return NextResponse.json(result.body as Record<string, unknown>, { status: result.status });
  }

  if (result.kind === "send") {
    const payload = typeof result.body === "string" ? result.body : new Uint8Array(result.body);
    return new Response(payload, { status: result.status, headers: result.headers });
  }

  // download
  const data = await readFile(result.path);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${result.filename.replace(/"/g, "")}"`
    }
  });
};

const errorResponse = (error: unknown): Response => {
  const isAppError = error instanceof AppError;
  const customStatusCode = Number((error as { statusCode?: number })?.statusCode);
  const status = isAppError
    ? error.statusCode
    : Number.isInteger(customStatusCode) && customStatusCode >= 400 && customStatusCode < 600
      ? customStatusCode
      : 500;

  const message = isAppError || (status >= 400 && status < 500)
    ? (error as Error).message || "Request failed"
    : "Internal server error";

  // Log unexpected (non-operational) failures so 500s are not silent.
  if (!isAppError && status >= 500) {
    logger.error("Unhandled request error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }

  return NextResponse.json({ success: false, error: { message } }, { status });
};

// Validates uploaded files against an allow-list of extensions and a size cap,
// replacing the old multer fileFilter/limits. Throws AppError on violation.
export const validateUploads = (
  files: UploadedFile[] | undefined,
  options: { allowedExtensions: string[]; maxFiles: number; maxBytes: number; label: string }
): void => {
  if (!files || files.length === 0) return;

  if (files.length > options.maxFiles) {
    throw new AppError(`A maximum of ${options.maxFiles} files can be uploaded at once`, 400);
  }

  const allowed = new Set(options.allowedExtensions.map((ext) => ext.toLowerCase()));
  for (const file of files) {
    if (file.size > options.maxBytes) {
      throw new AppError(`File exceeds ${Math.round(options.maxBytes / (1024 * 1024))}MB limit`, 400);
    }
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowed.has(ext)) {
      throw new AppError(options.label, 400);
    }
  }
};
