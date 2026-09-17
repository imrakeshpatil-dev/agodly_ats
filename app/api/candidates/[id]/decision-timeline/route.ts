import { handle } from "@/lib/server/http";
import { listCandidateDecisionTimeline } from "@/lib/server/controllers/candidate.controller";

// There is deliberately no write route. Audit entries are created only by
// protected server-side candidate decisions and are never edited by clients.
export const GET = handle(listCandidateDecisionTimeline, { auth: true });
