import { changeJobStatus } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(changeJobStatus, { auth: true });
