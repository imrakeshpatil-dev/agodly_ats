import { handle } from "@/lib/server/http";
import { logout } from "@/lib/server/controllers/auth.controller";

export const POST = handle(logout, { auth: true });
