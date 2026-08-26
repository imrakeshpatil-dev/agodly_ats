import { PIPELINE_STAGES } from "../constants/pipeline";
import { createId } from "../utils/id";

const FOUNDER_REVIEW_STAGE_SET = new Set<string>([
  "Submitted",
  "Client Review",
  "Interview",
  "Offer",
  "Onboarded"
]);

export interface FounderReviewActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface FounderReviewRequest {
  id: string;
  candidateId: string;
  stage: string;
  previousStage: string;
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  requestedBy: FounderReviewActor;
  rating: number | null;
  notes: string;
  reviewedAt: string;
  reviewedBy: FounderReviewActor | null;
}

interface CreateFounderReviewInput {
  candidateId: string;
  stage: string;
  previousStage: string;
  actor: FounderReviewActor;
  requestedAt?: string;
  reviewId?: string;
}

interface CompleteFounderReviewInput {
  reviewId: string;
  rating: number;
  notes?: string;
  actor: FounderReviewActor;
  reviewedAt?: string;
}

export const isFounderReviewStage = (stage: unknown): boolean =>
  FOUNDER_REVIEW_STAGE_SET.has(String(stage || "").trim());

export const getFounderReviewRequests = (parsedData: unknown): FounderReviewRequest[] => {
  const source = toRecord(parsedData);
  const rows = Array.isArray(source.founderReviewRequests) ? source.founderReviewRequests : [];

  return rows
    .map(normalizeReviewRequest)
    .filter((item): item is FounderReviewRequest => Boolean(item))
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
};

export const addFounderReviewRequest = (
  parsedData: unknown,
  input: CreateFounderReviewInput
): Record<string, unknown> => {
  const source = toRecord(parsedData);
  if (!isFounderReviewStage(input.stage) || input.stage === input.previousStage) return source;

  const requests = getFounderReviewRequests(source);
  const existingPending = requests.find(
    (item) => item.status === "PENDING" && item.stage === input.stage && item.previousStage === input.previousStage
  );
  if (existingPending) return source;

  const requestedAt = input.requestedAt || new Date().toISOString();
  const request: FounderReviewRequest = {
    id: input.reviewId || createId(),
    candidateId: input.candidateId,
    stage: input.stage,
    previousStage: input.previousStage,
    status: "PENDING",
    requestedAt,
    requestedBy: normalizeActor(input.actor),
    rating: null,
    notes: "",
    reviewedAt: "",
    reviewedBy: null
  };
  const timeline = normalizeTimeline(source.timeline);

  return {
    ...source,
    founderReviewRequests: [request, ...requests].slice(0, 100),
    timeline: [
      {
        id: createId(),
        eventType: "Founder rating requested",
        candidateId: input.candidateId,
        stage: input.stage,
        timestamp: requestedAt,
        user: request.requestedBy.name,
        remarks: `Candidate moved from ${input.previousStage || "Unknown"} to ${input.stage}`
      },
      ...timeline
    ].slice(0, 200)
  };
};

export const completeFounderReview = (
  parsedData: unknown,
  input: CompleteFounderReviewInput
): { parsedData: Record<string, unknown>; review: FounderReviewRequest | null } => {
  const source = toRecord(parsedData);
  const requests = getFounderReviewRequests(source);
  const index = requests.findIndex((item) => item.id === input.reviewId);
  if (index < 0 || requests[index].status !== "PENDING") return { parsedData: source, review: null };

  const reviewedAt = input.reviewedAt || new Date().toISOString();
  const rating = normalizeRating(input.rating);
  const notes = String(input.notes || "").trim().slice(0, 500);
  const completed: FounderReviewRequest = {
    ...requests[index],
    status: "COMPLETED",
    rating,
    notes,
    reviewedAt,
    reviewedBy: normalizeActor(input.actor)
  };
  requests[index] = completed;

  const tracking = toRecord(source.tracking);
  const timeline = normalizeTimeline(source.timeline);

  return {
    review: completed,
    parsedData: {
      ...source,
      founderReviewRequests: requests,
      tracking: {
        ...tracking,
        overallRating: rating,
        ratingNotes: notes || `Founder rating completed for ${completed.stage}`
      },
      timeline: [
        {
          id: createId(),
          eventType: "Founder rating completed",
          candidateId: completed.candidateId,
          stage: completed.stage,
          timestamp: reviewedAt,
          user: completed.reviewedBy?.name || "Founder",
          remarks: `Rated ${rating}/10${notes ? ` — ${notes}` : ""}`
        },
        ...timeline
      ].slice(0, 200)
    }
  };
};

const normalizeReviewRequest = (value: unknown): FounderReviewRequest | null => {
  const item = toRecord(value);
  const id = String(item.id || "").trim();
  const candidateId = String(item.candidateId || "").trim();
  const stage = String(item.stage || "").trim();
  if (!id || !candidateId || !PIPELINE_STAGES.includes(stage as (typeof PIPELINE_STAGES)[number])) return null;

  const rating = item.rating == null || item.rating === "" ? null : normalizeRating(Number(item.rating));
  const reviewedBy = item.reviewedBy ? normalizeActor(toRecord(item.reviewedBy) as unknown as FounderReviewActor) : null;

  return {
    id,
    candidateId,
    stage,
    previousStage: String(item.previousStage || ""),
    status: String(item.status || "").toUpperCase() === "COMPLETED" ? "COMPLETED" : "PENDING",
    requestedAt: String(item.requestedAt || ""),
    requestedBy: normalizeActor(toRecord(item.requestedBy) as unknown as FounderReviewActor),
    rating,
    notes: String(item.notes || ""),
    reviewedAt: String(item.reviewedAt || ""),
    reviewedBy
  };
};

const normalizeActor = (actor: FounderReviewActor): FounderReviewActor => ({
  id: String(actor?.id || ""),
  name: String(actor?.name || "System"),
  email: String(actor?.email || "").toLowerCase(),
  role: String(actor?.role || "")
});

const normalizeRating = (value: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(10, Math.max(1, Math.round(numeric * 2) / 2));
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

const normalizeTimeline = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => ({ ...(item as Record<string, unknown>) }))
    : [];
