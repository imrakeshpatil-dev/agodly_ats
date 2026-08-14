import { handle } from "@/lib/server/http";
import { syncBootstrapState } from "@/lib/server/controllers/bootstrap.controller";

export const POST = handle(syncBootstrapState, { auth: true });
