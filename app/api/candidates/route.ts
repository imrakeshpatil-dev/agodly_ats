import { handle } from "@/lib/server/http";
import { listCandidates, createCandidate } from "@/lib/server/controllers/candidate.controller";

export const GET = handle(listCandidates, { auth: true });
export const POST = handle(createCandidate, { auth: true });
