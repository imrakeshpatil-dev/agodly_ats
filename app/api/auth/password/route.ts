import { handle } from "@/lib/server/http";
import { setPassword } from "@/lib/server/controllers/auth.controller";

export const POST = handle(setPassword, { auth: true });
