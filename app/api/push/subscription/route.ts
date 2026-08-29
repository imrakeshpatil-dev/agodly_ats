import { subscribePush, unsubscribePush } from "@/lib/server/controllers/push.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(subscribePush, { auth: true });
export const DELETE = handle(unsubscribePush, { auth: true });
