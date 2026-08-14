export type CandidateStatus = "ACTIVE" | "DUPLICATE_PENDING" | "MERGED" | "IGNORED" | "DELETED";
export type CandidateParsingStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface CandidateRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  recruiter: string;
  stage: string;
  jobId: string;
  currentRole: string;
  skills: string[];
  experienceYears: number | null;
  profileSummary: string;
  keywords: string[];
  location: string;
  education: string;
  currentCompany: string;
  resumeUrl: string;
  parsedData: Record<string, unknown> | null;
  parsingStatus: CandidateParsingStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
  status: CandidateStatus;
  deletedAt?: string | null;
  duplicateOf: string[];
  mergedInto: string | null;
}

export interface CandidateInput {
  name: string;
  email: string;
  phone: string;
  recruiter: string;
  stage: string;
  jobId: string;
  currentRole: string;
  skills: string[];
  experienceYears: number | null;
  profileSummary: string;
  keywords: string[];
  location: string;
  education: string;
  currentCompany: string;
  resumeUrl?: string;
  parsedData?: Record<string, unknown> | null;
  parsingStatus?: CandidateParsingStatus;
  source: string;
}

export interface CandidateProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  recruiter?: string;
  stage?: string;
  jobId?: string;
  currentRole?: string;
  skills?: string[];
  experienceYears?: number | null;
  profileSummary?: string;
  keywords?: string[];
  location?: string;
  education?: string;
  currentCompany?: string;
  resumeUrl?: string;
  parsedData?: Record<string, unknown> | null;
  parsingStatus?: CandidateParsingStatus;
  source?: string;
}

export interface DuplicateGroup {
  duplicateCandidate: CandidateRecord;
  matchedCandidates: CandidateRecord[];
  reason: string;
}

export interface UploadFileResult {
  fileName: string;
  kind: string;
  status: "Completed" | "Blocked" | "Failed";
  added: number;
  blocked: number;
  message: string;
}

export interface BlockedDuplicateUpload {
  name: string;
  email: string;
  phone: string;
  reason: string;
  matchedCandidateIds: string[];
}

export interface BulkUploadResponse {
  summary: {
    totalFiles: number;
    pending: number;
    completed: number;
    failed: number;
    addedCandidates: number;
    duplicateCandidates: number;
  };
  results: UploadFileResult[];
  addedCandidates: CandidateRecord[];
  blockedDuplicates: BlockedDuplicateUpload[];
  duplicates: DuplicateGroup[];
}
