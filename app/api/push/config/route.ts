import { getPushConfig } from "@/lib/server/controllers/push.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(getPushConfig, { auth: true });
