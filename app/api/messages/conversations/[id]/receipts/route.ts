import { updateMessageReceipt } from "@/lib/server/controllers/messaging.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(updateMessageReceipt, { auth: true });
