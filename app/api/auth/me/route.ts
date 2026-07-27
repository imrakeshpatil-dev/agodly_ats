import { handle } from "@/lib/server/http";
import { me } from "@/lib/server/controllers/auth.controller";

export const GET = handle(me, { auth: true });
