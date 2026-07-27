import { handle } from "@/lib/server/http";
import { restoreCandidate } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(restoreCandidate, { auth: true });
