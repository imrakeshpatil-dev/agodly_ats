import { CandidateInput, CandidateRecord } from "../types/candidate";
import { normalizeEmail, normalizePhone } from "./text";

export interface CandidateIdentityMatch {
  email: boolean;
  phone: boolean;
}

export const matchCandidateIdentity = (
  incoming: Pick<CandidateInput, "email" | "phone">,
  existing: Pick<CandidateRecord, "email" | "phone">
): CandidateIdentityMatch => {
  const incomingEmail = normalizeEmail(incoming.email);
  const incomingPhone = normalizePhone(incoming.phone);

  return {
    email: Boolean(incomingEmail && normalizeEmail(existing.email) === incomingEmail),
    phone: Boolean(incomingPhone && normalizePhone(existing.phone) === incomingPhone)
  };
};

export const summarizeCandidateIdentityMatches = (
  incoming: Pick<CandidateInput, "email" | "phone">,
  matches: Array<Pick<CandidateRecord, "email" | "phone">>
): CandidateIdentityMatch => ({
  email: matches.some((candidate) => matchCandidateIdentity(incoming, candidate).email),
  phone: matches.some((candidate) => matchCandidateIdentity(incoming, candidate).phone)
});

export const buildBlockedDuplicateReason = (
  incoming: Pick<CandidateInput, "email" | "phone">,
  matches: Array<Pick<CandidateRecord, "email" | "phone">>
): string => {
  const matched = summarizeCandidateIdentityMatches(incoming, matches);

  if (matched.email && matched.phone) return "Blocked: email and phone already exist in the database";
  if (matched.email) return "Blocked: email already exists in the database";
  if (matched.phone) return "Blocked: phone number already exists in the database";
  return "Blocked: candidate already exists in the database";
};
