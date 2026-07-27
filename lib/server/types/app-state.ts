import { CandidateRecord } from "./candidate";

export interface AppStateSnapshot {
  bulkUpload: Record<string, unknown>;
  users: Array<Record<string, unknown>>;
  candidates: CandidateRecord[];
  clients: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  interviews: Array<Record<string, unknown>>;
  placements: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}

export interface AppStateStorePayload {
  bulkUpload?: Record<string, unknown>;
  users?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  jobs?: Array<Record<string, unknown>>;
  interviews?: Array<Record<string, unknown>>;
  placements?: Array<Record<string, unknown>>;
  activities?: Array<Record<string, unknown>>;
}
