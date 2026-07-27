import { handle } from "@/lib/server/http";
import { scoreAiMatch } from "@/lib/server/controllers/aiController";

export const POST = handle(scoreAiMatch, { auth: true });
