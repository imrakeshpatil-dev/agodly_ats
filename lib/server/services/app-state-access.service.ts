import { AppStateStorePayload } from "../types/app-state";
import { isFounderRole } from "./auth.service";
import type { AuthRole } from "./auth.service";

const RECRUITING_SYNC_FIELDS: Array<keyof AppStateStorePayload> = [
  "jobs",
  "interviews",
  "placements",
  "activities"
];

export const canSyncAppState = (role: AuthRole): boolean => role !== "Viewer";

export const scopeAppStatePayloadForRole = (
  payload: AppStateStorePayload,
  role: AuthRole
): AppStateStorePayload => {
  if (isFounderRole(role)) return { ...payload };

  const allowedFields = role === "TA Manager"
    ? (["clients", ...RECRUITING_SYNC_FIELDS] as Array<keyof AppStateStorePayload>)
    : RECRUITING_SYNC_FIELDS;

  return allowedFields.reduce<AppStateStorePayload>((scoped, field) => {
    const value = payload[field];
    if (value !== undefined) {
      Object.assign(scoped, { [field]: value });
    }
    return scoped;
  }, {});
};
