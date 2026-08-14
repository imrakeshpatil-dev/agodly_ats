# Recruiter data isolation

## Security boundary

All ATS API routes authenticate the bearer session in `lib/server/http.ts`. Record visibility is then decided by the central `authorizationService`; browser-side filtering is not treated as a security control.

Candidate ownership is represented by:

- `ownerUserId`: current owner of the candidate.
- `assignedRecruiterId`: explicit recruiter assignment.
- `uploadedByUserId`: authenticated user who created/uploaded the record.
- `recruiter`: legacy display attribution only; it is not trusted when an ownership ID exists.

Manual entry, resume processing, and bulk upload set `uploadedByUserId` from the authenticated session and normally set the owner/assignee to the same user. A Recruiter cannot change ownership through a crafted profile payload. A TA Manager may assign within their direct team. Founder roles may assign company-wide. Ownership changes and denied attempts are security-audited without candidate content.

The additive migration `20260814070000_add_candidate_ownership` adds the three nullable ownership columns and indexes. It does not delete, replace, or truncate production data. Legacy RuntimeState candidate records are normalized on read and backfilled from existing authenticated upload metadata where available.

## Role permissions

### Admin / founder roles

CEO, Managing Director, and Admin can view and manage all ATS records, company-wide operational data, finance, diagnostics, and ownership assignments.

### TA Manager

A TA Manager can view and manage their own records and records owned, assigned, or uploaded by direct reports identified through `managerId`, manager email, or the existing manager identity. Candidate-linked submissions, interviews, placements, and activities inherit the candidate boundary. Ownership can be reassigned only within the manager's permitted team.

### Recruiter

A Recruiter can view candidates they own, are explicitly assigned, or uploaded while ownership remains unset. They cannot list, open, edit, delete, restore, merge, reparse, or download the resume of another recruiter's candidate. Candidate-linked submissions, pipeline records, interviews, follow-ups, activities, dashboards, reports, search results, and exports use the same scoped bootstrap data.

Recruiters can view jobs explicitly assigned to them. Jobs with no ownership/assignment metadata remain intentionally company-visible, but do not grant access to protected candidates. Recruiters cannot modify an unassigned or another recruiter's job. Client visibility is limited to clients required by visible jobs. Revenue, cost, margin, billing rate, and CTC fields are removed from recruiter/manager placement snapshots unless the role already has founder finance access.

Viewer accounts are read-only and receive the same data visibility boundary as their identity/team scope.

## Candidate Pool, pipeline, notes, reports, and exports

Candidate Pool is not a shared-company bypass. It is rendered from the backend-scoped candidate collection. Pipeline submissions are stored inside authorized candidate records, while separate interview, placement, and activity collections are filtered against permitted candidate IDs.

Private-note authorization is owner/team aware in the central service. This application currently has no independent notes API; notes/submissions embedded in a candidate cannot be retrieved without candidate permission. A future independent notes route must call `canViewPrivateNote` before returning content.

Dashboards, totals, reports, autocomplete/search, and browser-generated exports operate only on the scoped bootstrap snapshot. There is currently no server export endpoint. If one is added, it must re-resolve every requested candidate through the authorization service and must never trust browser-selected IDs.

Bulk-upload history is stored per authenticated user. Candidate notes in historical upload snapshots are re-filtered against permitted candidate IDs, duplicate matches belonging to other recruiters are removed, and blocked duplicate responses do not disclose matched candidate IDs.

## MY LLM and AI Match

Authenticated user context is mandatory at every AI controller. Candidate search, count, JD matching, candidate summary, and ATS-sheet tools use scoped candidate-store methods. Authenticated AI calls never use the unrestricted Prisma/fallback path. Candidate IDs outside scope return not found and are audit-logged.

AI conversations, learned memories, result previews, and feedback are owned by `ownerUserId`. Reusing or guessing another browser conversation or interaction ID does not expose or modify another recruiter's AI history. AI tools do not execute raw SQL.

## CV and document access

Resumes are kept in runtime data storage, not a public static directory. The download route authenticates the request, resolves the candidate through the scoped candidate-store lookup, verifies permission, validates that the resolved path remains inside the resume directory, and only then streams the file. Guessing a candidate ID, filename, or path cannot bypass this check.

## Audit logging

Denied record lookups and ownership violations record only user ID, endpoint, entity type, entity ID, and timestamp in the `authorization-audit-v1` RuntimeState record. Candidate content is not logged. AI summary and feedback denials are included. Successful privileged ownership changes are also recorded as security events.

## Verification coverage

`tests/recruiter-data-isolation.test.ts` creates Admin A, Manager A, Recruiter A, Recruiter B, Candidate A, and Candidate B authorization fixtures. It proves reciprocal recruiter isolation across list/single/update APIs, candidate-linked state, jobs, clients, interviews, placements, activities, upload history, finance fields, sync payloads, malicious Candidate B IDs, MY LLM tools, conversations, memories, and feedback. Manager team scope and Admin company scope are also covered.

Final release verification must run:

```text
npm run lint
npm run typecheck
npm test
npm run prisma:validate
npm run build
```

Production deployment is permitted only while every command and recruiter-isolation test passes.

## Release status

- SECURITY ISSUE FIXED: YES
- Recruiter isolation tests: PASS
- Candidate APIs protected: PASS
- Resume access protected: PASS
- Pipeline protected: PASS
- MY LLM protected: PASS
- Reports/exports protected: PASS
- Frontend tested: PASS
- Production build: PASS
