import { handle } from "@/lib/server/http";
import { softDeleteCandidate } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(softDeleteCandidate, { auth: true });
