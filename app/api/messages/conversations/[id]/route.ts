import { getConversation } from "@/lib/server/controllers/messaging.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(getConversation, { auth: true });
