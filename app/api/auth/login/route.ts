import { handle } from "@/lib/server/http";
import { login } from "@/lib/server/controllers/auth.controller";

export const POST = handle(login);
