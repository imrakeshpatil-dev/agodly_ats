import { testPush } from "@/lib/server/controllers/push.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(testPush, { auth: true });
