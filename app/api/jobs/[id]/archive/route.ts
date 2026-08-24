import { archiveJob } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const POST = handle(archiveJob, { auth: true });
