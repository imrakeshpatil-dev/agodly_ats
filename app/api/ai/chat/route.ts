import { handle } from "@/lib/server/http";
import { chatWithAi } from "@/lib/server/controllers/aiController";

export const POST = handle(chatWithAi, { auth: true });
