import { NextResponse } from "next/server";
import type { AuthedUser } from "@/lib/authz";

/** What requireSession() returns with no session — mock it in to test a route's 401 path. */
export function unauthedResponse(): NextResponse {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function makeAuthedUser(overrides: Partial<AuthedUser> = {}): AuthedUser {
  return { id: "user-1", auth0Sub: "auth0|1", email: "a@b.com", role: "User", ...overrides };
}

export function makeJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** The second argument Next passes to a dynamic route handler — `params` is a Promise in Next 16. */
export function routeContext<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
