export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const normalizePhone = (value: string): string => value.replace(/\D/g, "");

export const uniqueStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  items.forEach((item) => {
    const clean = item.trim();
    if (!clean) return;

    const key = clean.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    output.push(clean);
  });

  return output;
};
