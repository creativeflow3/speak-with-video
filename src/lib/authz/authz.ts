import { NextResponse } from "next/server";
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

export async function requireSession(): Promise<AuthedUser | NextResponse> {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const auth0Sub = session.user.sub;
  const email = session.user.email ?? "";
  const role = roleFromClaims(session.user);

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

export async function requireAdmin(): Promise<AuthedUser | NextResponse> {
  const result = await requireSession();
  if (result instanceof NextResponse) return result;
  if (result.role !== "Admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return result;
}
