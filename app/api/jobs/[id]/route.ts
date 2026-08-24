import { deleteJob, getJob, updateJob } from "@/lib/server/controllers/job.controller";
import { handle } from "@/lib/server/http";

export const GET = handle(getJob, { auth: true });
export const PATCH = handle(updateJob, { auth: true });
export const DELETE = handle(deleteJob, { auth: true });
