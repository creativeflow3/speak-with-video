const DEFAULT_DB_CONNECTION = "Username-Password-Authentication";
const REQUEST_TIMEOUT_MS = 10_000;

// Auth0 user ids are "<provider>|<id>"; "auth0" is the email/password database connection.
const PROVIDER_NAMES: Record<string, string> = {
  auth0: "Email and password",
  "google-oauth2": "Google",
  github: "GitHub",
  apple: "Apple",
  windowslive: "Microsoft",
};

export class PasswordResetError extends Error {
  name = "PasswordResetError";
}

function providerOf(auth0Sub: string): string {
  return auth0Sub.split("|")[0];
}

/** True for email/password accounts — the only ones with a password we can change. */
export function hasDatabasePassword(auth0Sub: string): boolean {
  return providerOf(auth0Sub) === "auth0";
}

/** A human name for how the user signs in, e.g. "Google" or "Email and password". */
export function loginMethodFor(auth0Sub: string): string {
  const provider = providerOf(auth0Sub);
  return PROVIDER_NAMES[provider] ?? provider;
}

function changePasswordUrl(): string {
  const domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) throw new PasswordResetError("AUTH0_DOMAIN is not set");
  return `https://${domain}/dbconnections/change_password`;
}

/**
 * Asks Auth0 to email the user a password-change link. Auth0's hosted page then
 * enforces the password policy and breach detection, so no password touches this app.
 */
export async function requestPasswordChange(email: string): Promise<void> {
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!clientId) throw new PasswordResetError("AUTH0_CLIENT_ID is not set");

  let res: Response;
  try {
    res = await fetch(changePasswordUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        email,
        connection: process.env.AUTH0_DB_CONNECTION || DEFAULT_DB_CONNECTION,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new PasswordResetError(`Auth0 request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new PasswordResetError(`Auth0 returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
