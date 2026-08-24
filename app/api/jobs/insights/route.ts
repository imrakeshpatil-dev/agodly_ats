import { listJobInsights } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(listJobInsights, { auth: true });
