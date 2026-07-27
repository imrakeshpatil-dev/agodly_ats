import { handle } from "@/lib/server/http";
import { healthCheck } from "@/lib/server/controllers/health.controller";

export const dynamic = "force-dynamic";
export const GET = handle(healthCheck);
