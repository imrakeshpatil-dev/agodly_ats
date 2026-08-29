import { createConversation, listConversations } from "@/lib/server/controllers/messaging.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(listConversations, { auth: true });
export const POST = handle(createConversation, { auth: true });
