import { handle } from "@/lib/server/http";
import { getBootstrapState } from "@/lib/server/controllers/bootstrap.controller";

export const GET = handle(getBootstrapState, { auth: true });
