import { handle } from "@/lib/server/http";
import { submitFounderCandidateReview } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(submitFounderCandidateReview, { auth: true });
