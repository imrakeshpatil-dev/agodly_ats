import { createInsightCandidatePool } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(createInsightCandidatePool, { auth: true });
