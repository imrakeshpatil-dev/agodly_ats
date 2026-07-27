import { handle } from "@/lib/server/http";
import { reparseCandidateWithAI } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(reparseCandidateWithAI, { auth: true });
