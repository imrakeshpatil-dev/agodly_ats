import { handle } from "@/lib/server/http";
import { mergeDuplicate } from "@/lib/server/controllers/candidate.controller";

export const POST = handle(mergeDuplicate, { auth: true });
