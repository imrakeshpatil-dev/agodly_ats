import { handle } from "@/lib/server/http";
import { diagnosticsCheck } from "@/lib/server/controllers/health.controller";

export const GET = handle(diagnosticsCheck, { founder: true });
