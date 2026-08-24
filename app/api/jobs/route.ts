import { createJob, listJobs } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(listJobs, { auth: true });
export const POST = handle(createJob, { auth: true });
