import type { AuthedUser } from "@/lib/authz";

export function makeAuthedUser(overrides: Partial<AuthedUser> = {}): AuthedUser {
  return { id: "user-1", auth0Sub: "auth0|1", email: "a@b.com", role: "User", ...overrides };
}

export function makeJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
