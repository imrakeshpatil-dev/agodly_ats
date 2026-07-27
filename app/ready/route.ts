import { handle } from "@/lib/server/http";
import { readinessCheck } from "@/lib/server/controllers/health.controller";

export const dynamic = "force-dynamic";
export const GET = handle(readinessCheck);
