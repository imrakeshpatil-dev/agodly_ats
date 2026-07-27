import { handle } from "@/lib/server/http";
import { ignoreDuplicate } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(ignoreDuplicate, { auth: true });
