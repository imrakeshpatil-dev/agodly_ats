export const PIPELINE_STAGES = [
  "Identified",
  "Qualified",
  "Submitted",
  "Client Review",
  "Interview",
  "Offer",
  "Onboarded",
  "On Hold",
  "Pool",
  "Dropped"
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const isPipelineStage = (value: unknown): value is PipelineStage =>
  PIPELINE_STAGES.includes(String(value || "").trim() as PipelineStage);

export const normalizePipelineStage = (value: unknown): PipelineStage => {
  const stage = String(value || "").trim();
  return isPipelineStage(stage) ? stage : "Identified";
};
