import { getPushPreferences, updatePushPreferences } from "@/lib/server/controllers/push.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(getPushPreferences, { auth: true });
export const PUT = handle(updatePushPreferences, { auth: true });
export const PATCH = handle(updatePushPreferences, { auth: true });
