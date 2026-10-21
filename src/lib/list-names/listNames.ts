// Client-safe (no db import) so the dashboard form and the server share one rule.
export const MAX_LIST_NAME_LENGTH = 100;

type ListNameResult = { name: string } | { error: string };

/** Trims a proposed list name and checks it is non-empty and within the length limit. */
export function validateListName(raw: string): ListNameResult {
  const name = raw.trim();
  if (!name) return { error: "List name is required" };
  if (name.length > MAX_LIST_NAME_LENGTH) {
    return { error: `List name must be ${MAX_LIST_NAME_LENGTH} characters or fewer` };
  }
  return { name };
}
