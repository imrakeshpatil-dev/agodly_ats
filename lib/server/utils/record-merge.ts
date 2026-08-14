export interface MergeRowsOptions {
  preferNewestUpdatedAt?: boolean;
}

export const mergeRowsByIdentity = (
  rows: unknown,
  fallback: Array<Record<string, unknown>>,
  options: MergeRowsOptions = {}
): Array<Record<string, unknown>> => {
  if (!Array.isArray(rows)) return fallback.map((item) => ({ ...item }));

  const existing = fallback.map((item) => ({ ...item }));
  const merged = new Map<string, Record<string, unknown>>();
  const order: string[] = [];

  existing.forEach((row, index) => {
    const key = getRowIdentity(row) || `existing:${index}`;
    merged.set(key, row);
    order.push(key);
  });

  rows
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .forEach((item, index) => {
      const incoming = { ...(item as Record<string, unknown>) };
      const key = getRowIdentity(incoming) || `incoming:${Date.now()}:${index}`;
      const current = merged.get(key);

      if (!order.includes(key)) order.push(key);
      if (current && options.preferNewestUpdatedAt && isIncomingOlder(incoming, current)) {
        return;
      }
      merged.set(key, current ? { ...current, ...incoming } : incoming);
    });

  return order.map((key) => merged.get(key)).filter((item): item is Record<string, unknown> => Boolean(item));
};

const isIncomingOlder = (
  incoming: Record<string, unknown>,
  current: Record<string, unknown>
): boolean => {
  const incomingTimestamp = parseTimestamp(incoming.updatedAt);
  const currentTimestamp = parseTimestamp(current.updatedAt);

  if (currentTimestamp === null) return false;
  if (incomingTimestamp === null) return true;
  return incomingTimestamp < currentTimestamp;
};

const parseTimestamp = (value: unknown): number | null => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getRowIdentity = (row: Record<string, unknown>): string => {
  const id = String(row.id || "").trim();
  if (id) return `id:${id}`;

  const email = String(row.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const name = String(row.name || row.title || "").trim().toLowerCase();
  const createdAt = String(row.createdAt || row.scheduledAt || "").trim();
  if (name && createdAt) return `name-date:${name}:${createdAt}`;

  return "";
};
