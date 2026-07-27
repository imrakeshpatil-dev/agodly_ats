import { handle } from "@/lib/server/http";
import { getCandidate, updateCandidateProfile } from "@/lib/server/controllers/candidate.controller";

export const GET = handle(getCandidate, { auth: true });
export const PUT = handle(updateCandidateProfile, { auth: true });
