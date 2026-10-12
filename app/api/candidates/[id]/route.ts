import { handle } from "@/lib/server/http";
import { getCandidate, permanentlyDeleteCandidate, updateCandidateProfile } from "@/lib/server/controllers/candidate.controller";

export const GET = handle(getCandidate, { auth: true });
export const PUT = handle(updateCandidateProfile, { auth: true });
export const DELETE = handle(permanentlyDeleteCandidate, { auth: true });
