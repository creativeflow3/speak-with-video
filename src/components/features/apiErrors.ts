export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

interface ErrorMessages {
  rateLimited?: string;
  fallback?: string;
}

/** The message to show for a failed API response: the server's own `error` text, else one chosen by status. */
export async function errorMessageFor(res: Response, messages: ErrorMessages = {}): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (data.error) return data.error;
  if (res.status === 429) return messages.rateLimited ?? "Too many requests. Wait a bit and try again.";
  return messages.fallback ?? "Something went wrong. Try again.";
}
