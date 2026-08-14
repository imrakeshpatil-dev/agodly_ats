import { CandidateInput } from "../types/candidate";

export interface BulkUploadActor {
  id: string;
  name: string;
  email: string;
}

export const resolveBulkUploadActorName = (actor: BulkUploadActor): string => {
  const name = String(actor.name || "").trim();
  const email = String(actor.email || "").trim();
  return name || email || "Unknown User";
};

export const attributeCandidateToUploader = (
  candidate: CandidateInput,
  actor: BulkUploadActor,
  uploadedAt = new Date().toISOString()
): CandidateInput => {
  const uploaderName = resolveBulkUploadActorName(actor);

  return {
    ...candidate,
    ownerUserId: String(actor.id || "") || null,
    uploadedByUserId: String(actor.id || "") || null,
    assignedRecruiterId: String(actor.id || "") || null,
    recruiter: uploaderName,
    parsedData: {
      ...(candidate.parsedData || {}),
      uploadedBy: uploaderName,
      uploadedByUserId: String(actor.id || ""),
      uploadedAt
    }
  };
};
