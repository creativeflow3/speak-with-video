import { cache } from "react";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth0, ROLES_CLAIM } from "@/lib/auth0";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";

export interface AuthedUser {
  id: string;
  auth0Sub: string;
  email: string;
  role: UserRole;
}

function roleFromClaims(user: Record<string, unknown>): UserRole {
  const roles = user[ROLES_CLAIM];
  return Array.isArray(roles) && roles.includes("Admin") ? "Admin" : "User";
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>["user"];

/** Finds the database user for an Auth0 session, creating it or syncing a changed email/role. */
async function upsertSessionUser(sessionUser: SessionUser): Promise<AuthedUser> {
  const auth0Sub = sessionUser.sub;
  const email = sessionUser.email ?? "";
  const role = roleFromClaims(sessionUser);

  const [existing] = await db.select().from(users).where(eq(users.auth0Sub, auth0Sub)).limit(1);
  if (existing && existing.email === email && existing.role === role) {
    return existing;
  }

  const [user] = await db
    .insert(users)
    .values({ auth0Sub, email, role })
    .onConflictDoUpdate({ target: users.auth0Sub, set: { email, role } })
    .returning();

  return user;
}

/** The Auth0 session, read once per request however many layouts and pages ask for it. */
export const getSession = cache(() => auth0.getSession());

/** What the app greets a session user as: their name, else their email. */
export function displayNameFor(sessionUser: SessionUser): string {
  return sessionUser.name ?? sessionUser.email ?? "there";
}

/** The signed-in user, or null when there is no session. Cached per request, like getSession. */
export const getSessionUser = cache(async (): Promise<AuthedUser | null> => {
  const session = await getSession();
  return session ? upsertSessionUser(session.user) : null;
});

/** For API routes: the signed-in user, or a 401 response to return as-is. */
export async function requireSession(): Promise<AuthedUser | NextResponse> {
  const user = await getSessionUser();
  return user ?? NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

/**
 * For dashboard pages: the signed-in user, or a redirect to login that returns here afterwards.
 * Each page calls this itself — layouts don't re-render on navigation, so they can't guard pages.
 */
export async function getDashboardUser(returnTo: string): Promise<AuthedUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin(): Promise<AuthedUser | NextResponse> {
  const result = await requireSession();
  if (result instanceof NextResponse) return result;
  if (result.role !== "Admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return result;
}
