import { handle } from "@/lib/server/http";
import { listPendingDuplicates } from "@/lib/server/controllers/candidate.controller";

export const GET = handle(listPendingDuplicates, { auth: true });
