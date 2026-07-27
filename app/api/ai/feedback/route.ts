import { handle } from "@/lib/server/http";
import { submitAiFeedback } from "@/lib/server/controllers/aiController";

export const POST = handle(submitAiFeedback, { auth: true });
