import { AIWorkloadTier } from "./aiProvider";

const COMPLEX_RECRUITING_PATTERNS = [
  /\bcompare\b[\s\S]{0,80}\b(candidates?|profiles?|shortlists?)\b/i,
  /\b(candidates?|profiles?|shortlists?)\b[\s\S]{0,80}\bcompare\b/i,
  /\b(historical\s+)?(hiring\s+)?demand\s+(insights?|analysis|forecast|trends?)\b/i,
  /\b(workforce|talent|hiring)\s+(forecast|trend|planning|analysis)\b/i,
  /\b(deep|detailed|comprehensive|multi-factor)\s+(analysis|comparison|assessment|review)\b/i,
  /\banaly[sz]e\b[\s\S]{0,80}\b(across|multiple|all)\s+(jobs?|candidates?|roles?|clients?)\b/i
];

export const selectAIWorkloadTier = (prompt: string): AIWorkloadTier => {
  const cleanPrompt = String(prompt || "").trim();
  if (cleanPrompt.length >= 4_000) return "complex";
  if (COMPLEX_RECRUITING_PATTERNS.some((pattern) => pattern.test(cleanPrompt))) return "complex";
  return "standard";
};
