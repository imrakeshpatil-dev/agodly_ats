import { Prisma } from "@prisma/client";

import type { AuthUser } from "./auth.service";
import { prisma } from "./prisma.service";
import type { CandidateProfileUpdate, CandidateRecord } from "../types/candidate";

export type CandidateDecisionAuditAction =
  | "SHORTLIST_DECISION"
  | "REJECTION"
  | "STAGE_MOVED"
  | "RATING"
  | "OWNERSHIP_CHANGED"
  | "FEEDBACK";

export interface CandidateDecisionAuditEvent {
  id: string;
  candidateId: string;
  jobId: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: CandidateDecisionAuditAction;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

interface CandidateDecisionAuditInput {
  existing: CandidateRecord;
  updated: CandidateRecord;
  patch: CandidateProfileUpdate;
  actor: AuthUser;
}

type UnknownRecord = Record<string, unknown>;

class CandidateDecisionAuditService {
  private readonly stateKey = "candidate-decision-audit-v1";
  private readonly maxEvents = 5_000;

  async listForCandidate(candidateId: string): Promise<CandidateDecisionAuditEvent[]> {
    const row = await prisma.runtimeState.findUnique({ where: { key: this.stateKey } });
    return normalizeEvents(row?.value)
      .filter((event) => event.candidateId === candidateId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 200);
  }

  async recordCandidateUpdate(input: CandidateDecisionAuditInput): Promise<CandidateDecisionAuditEvent[]> {
    const events = deriveCandidateDecisionAuditEvents(input);
    const recorded: CandidateDecisionAuditEvent[] = [];
    for (const event of events) {
      recorded.push(await this.append(event));
    }
    return recorded;
  }

  async recordFounderReview(input: {
    candidate: CandidateRecord;
    actor: AuthUser;
    rating: number;
    notes: string;
    reviewId: string;
  }): Promise<CandidateDecisionAuditEvent> {
    return this.append({
      candidateId: input.candidate.id,
      jobId: nonEmpty(input.candidate.jobId),
      actorId: input.actor.id,
      actorName: actorName(input.actor),
      actorRole: input.actor.role,
      action: "RATING",
      reason: input.notes || "Founder review completed",
      before: null,
      after: { rating: input.rating, reviewId: input.reviewId, source: "Founder review" }
    });
  }

  private async append(event: Omit<CandidateDecisionAuditEvent, "id" | "createdAt">): Promise<CandidateDecisionAuditEvent> {
    const auditEvent: CandidateDecisionAuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      // The timestamp is intentionally assigned here. Client-provided dates are
      // retained only as context in before/after; they never control the audit clock.
      createdAt: new Date().toISOString()
    };

    await prisma.$transaction(async (transaction) => {
      const current = await transaction.runtimeState.findUnique({ where: { key: this.stateKey } });
      const events = [auditEvent, ...normalizeEvents(current?.value)].slice(0, this.maxEvents);
      const value = events as unknown as Prisma.InputJsonValue;
      await transaction.runtimeState.upsert({
        where: { key: this.stateKey },
        create: { key: this.stateKey, value },
        update: { value }
      });
    });

    return auditEvent;
  }
}

export const deriveCandidateDecisionAuditEvents = (input: CandidateDecisionAuditInput): Omit<CandidateDecisionAuditEvent, "id" | "createdAt">[] => {
  const { existing, updated, patch, actor } = input;
  const actorDetails = {
    actorId: actor.id,
    actorName: actorName(actor),
    actorRole: actor.role
  };
  const beforeData = asRecord(existing.parsedData);
  const afterData = asRecord(updated.parsedData);
  const events: Omit<CandidateDecisionAuditEvent, "id" | "createdAt">[] = [];

  const existingRejected = existing.stage === "Dropped" || normalizedTrackingStatus(beforeData) === "rejected";
  const updatedRejected = updated.stage === "Dropped" || normalizedTrackingStatus(afterData) === "rejected";
  const stageChanged = patch.stage !== undefined && existing.stage !== updated.stage;
  const becameRejected = !existingRejected && updatedRejected && patch.parsedData !== undefined;
  if (stageChanged || becameRejected) {
    const transition = newestNewEntry(beforeData.stageHistory, afterData.stageHistory);
    const rejection = updatedRejected;
    const reason = text(
      transition?.reason,
      transition?.feedback,
      transition?.comment,
      trackingReason(afterData),
      rejection ? "No reason recorded" : "Stage updated"
    );
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(text(transition?.jobId, updated.jobId)),
      action: rejection ? "REJECTION" : "STAGE_MOVED",
      reason,
      before: { stage: existing.stage, trackingStatus: normalizedTrackingStatus(beforeData) || null },
      after: { stage: updated.stage, trackingStatus: normalizedTrackingStatus(afterData) || null, movementSource: text(transition?.source, "ATS") }
    });
  }

  if (ownershipChanged(existing, updated, patch)) {
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(updated.jobId),
      action: "OWNERSHIP_CHANGED",
      reason: "Candidate ownership updated",
      before: ownershipSnapshot(existing),
      after: ownershipSnapshot(updated)
    });
  }

  const beforeTracking = asRecord(beforeData.tracking);
  const afterTracking = asRecord(afterData.tracking);
  const ratingsChanged = ["technicalRating", "communicationRating", "overallRating"]
    .some((field) => hasChanged(beforeTracking[field], afterTracking[field]));
  if (ratingsChanged) {
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(updated.jobId),
      action: "RATING",
      reason: text(afterTracking.ratingNotes, "Rating updated"),
      before: ratingSnapshot(beforeTracking),
      after: ratingSnapshot(afterTracking)
    });
  }

  for (const entry of newEntries(beforeData.shortlistDecisions, afterData.shortlistDecisions)) {
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(text(entry.jobId, updated.jobId)),
      action: "SHORTLIST_DECISION",
      reason: text(entry.note, entry.decision, "Shortlist decision recorded"),
      before: null,
      after: { decision: text(entry.decision), jobTitle: text(entry.jobTitle) }
    });
  }

  for (const note of newEntries(beforeData.collaborationNotes, afterData.collaborationNotes)) {
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(updated.jobId),
      action: "FEEDBACK",
      reason: text(note.text, "Team feedback added"),
      before: null,
      after: { mentions: stringArray(note.mentions), feedbackType: "Team note" }
    });
  }

  for (const feedback of newEntries(beforeData.feedbackHistory, afterData.feedbackHistory)) {
    const reason = text(feedback.feedback, feedback.clientFeedback, feedback.dropReason);
    if (!reason) continue;
    events.push({
      ...actorDetails,
      candidateId: updated.id,
      jobId: nonEmpty(updated.jobId),
      action: "FEEDBACK",
      reason,
      before: null,
      after: { feedbackType: text(feedback.feedbackType, "Feedback") }
    });
  }

  return events;
};

const normalizeEvents = (value: unknown): CandidateDecisionAuditEvent[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((event): event is UnknownRecord => Boolean(event && typeof event === "object" && !Array.isArray(event)))
    .map((event) => ({
      id: text(event.id),
      candidateId: text(event.candidateId),
      jobId: nonEmpty(event.jobId),
      actorId: text(event.actorId),
      actorName: text(event.actorName, "System"),
      actorRole: text(event.actorRole),
      action: normalizeAction(event.action),
      reason: text(event.reason, "No reason recorded"),
      before: asOptionalRecord(event.before),
      after: asOptionalRecord(event.after),
      createdAt: text(event.createdAt)
    }))
    .filter((event) => Boolean(event.id && event.candidateId && event.createdAt));
};

const normalizeAction = (value: unknown): CandidateDecisionAuditAction => {
  const allowed: CandidateDecisionAuditAction[] = ["SHORTLIST_DECISION", "REJECTION", "STAGE_MOVED", "RATING", "OWNERSHIP_CHANGED", "FEEDBACK"];
  return allowed.includes(value as CandidateDecisionAuditAction) ? value as CandidateDecisionAuditAction : "FEEDBACK";
};

const ownershipChanged = (existing: CandidateRecord, updated: CandidateRecord, patch: CandidateProfileUpdate): boolean =>
  (patch.ownerUserId !== undefined && existing.ownerUserId !== updated.ownerUserId) ||
  (patch.assignedRecruiterId !== undefined && existing.assignedRecruiterId !== updated.assignedRecruiterId) ||
  (patch.recruiter !== undefined && existing.recruiter !== updated.recruiter);

const ownershipSnapshot = (candidate: CandidateRecord): Record<string, unknown> => ({
  ownerUserId: candidate.ownerUserId,
  assignedRecruiterId: candidate.assignedRecruiterId,
  recruiter: candidate.recruiter
});

const ratingSnapshot = (tracking: UnknownRecord): Record<string, unknown> => ({
  technicalRating: tracking.technicalRating ?? null,
  communicationRating: tracking.communicationRating ?? null,
  overallRating: tracking.overallRating ?? null
});

const newestNewEntry = (before: unknown, after: unknown): UnknownRecord | null => newEntries(before, after)[0] || null;

const newEntries = (before: unknown, after: unknown): UnknownRecord[] => {
  const known = new Set(asRecordArray(before).map(entryKey));
  return asRecordArray(after).filter((entry) => !known.has(entryKey(entry)));
};

const entryKey = (entry: UnknownRecord): string =>
  text(entry.id, `${text(entry.createdAt, entry.timestamp)}:${text(entry.text, entry.decision, entry.comment, entry.feedback)}`);

const normalizedTrackingStatus = (data: UnknownRecord): string => text(asRecord(data.tracking).trackingStatus).toLowerCase();

const trackingReason = (data: UnknownRecord): string => text(asRecord(data.tracking).rejectionReason);

const hasChanged = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};

const asOptionalRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;

const asRecordArray = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];

const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

const text = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const nonEmpty = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const actorName = (actor: AuthUser): string => actor.name || actor.email || "System";

export const candidateDecisionAuditService = new CandidateDecisionAuditService();
