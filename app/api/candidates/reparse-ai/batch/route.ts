import { handle } from "@/lib/server/http";
import { reparseCandidatesBatchWithAI } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(reparseCandidatesBatchWithAI, { auth: true });
