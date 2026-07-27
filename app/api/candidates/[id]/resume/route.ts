import { handle } from "@/lib/server/http";
import { downloadCandidateResume } from "@/lib/server/controllers/candidate.controller";

export const GET = handle(downloadCandidateResume, { auth: true });
