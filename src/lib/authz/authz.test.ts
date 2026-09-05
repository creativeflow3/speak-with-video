import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { auth0, ROLES_CLAIM } from "@/lib/auth0";
import { requireSession, requireAdmin, type AuthedUser } from "./authz";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  return { select, insert, limit, values, returning };
});

vi.mock("@/db", () => ({ db: { select: mocks.select, insert: mocks.insert } }));
vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: vi.fn() },
  ROLES_CLAIM: "https://speak-with-video.app/roles",
}));

type Session = Awaited<ReturnType<typeof auth0.getSession>>;

const existingUser: AuthedUser = { id: "u1", auth0Sub: "auth0|abc", email: "a@b.com", role: "User" };

function fakeSession(userOverrides: Record<string, unknown> = {}): Session {
  return { user: { sub: "auth0|abc", email: "a@b.com", ...userOverrides } } as unknown as Session;
}

beforeEach(() => {
  vi.mocked(auth0.getSession).mockReset();
  mocks.limit.mockReset();
  mocks.values.mockClear();
  mocks.returning.mockReset();
});

describe("requireSession", () => {
  it("returns a 401 response when there is no session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const result = await requireSession();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns the existing user without writing when email and role already match", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession());
    mocks.limit.mockResolvedValue([existingUser]);

    const result = await requireSession();

    expect(result).toEqual(existingUser);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("upserts and returns the new user when none exists yet", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession());
    mocks.limit.mockResolvedValue([]);
    const created = { ...existingUser, id: "u2" };
    mocks.returning.mockResolvedValue([created]);

    const result = await requireSession();

    expect(mocks.values).toHaveBeenCalledWith({ auth0Sub: "auth0|abc", email: "a@b.com", role: "User" });
    expect(result).toEqual(created);
  });

  it("upserts when the stored email is stale", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession({ email: "new@b.com" }));
    mocks.limit.mockResolvedValue([existingUser]);
    const updated = { ...existingUser, email: "new@b.com" };
    mocks.returning.mockResolvedValue([updated]);

    const result = await requireSession();

    expect(mocks.insert).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("derives the Admin role from the roles claim and upserts it", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession({ [ROLES_CLAIM]: ["Admin"] }));
    mocks.limit.mockResolvedValue([existingUser]); // stored role is "User" — stale
    const promoted = { ...existingUser, role: "Admin" as const };
    mocks.returning.mockResolvedValue([promoted]);

    const result = await requireSession();

    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ role: "Admin" }));
    expect(result).toEqual(promoted);
  });

  it("defaults the role to User when the roles claim is missing or not an array", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession({ [ROLES_CLAIM]: "Admin" }));
    mocks.limit.mockResolvedValue([]);
    mocks.returning.mockResolvedValue([existingUser]);

    await requireSession();

    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ role: "User" }));
  });

  it("defaults a missing session email to an empty string", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(
      { user: { sub: "auth0|xyz" } } as unknown as Session,
    );
    mocks.limit.mockResolvedValue([]);
    mocks.returning.mockResolvedValue([{ id: "u3", auth0Sub: "auth0|xyz", email: "", role: "User" }]);

    await requireSession();

    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ auth0Sub: "auth0|xyz", email: "" }));
  });
});

describe("requireAdmin", () => {
  it("passes through the 401 from requireSession when there is no session", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);

    const result = await requireAdmin();

    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 403 when the user is not an Admin", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession());
    mocks.limit.mockResolvedValue([existingUser]);

    const result = await requireAdmin();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the user when they are an Admin", async () => {
    const adminUser = { ...existingUser, role: "Admin" as const };
    vi.mocked(auth0.getSession).mockResolvedValue(fakeSession({ [ROLES_CLAIM]: ["Admin"] }));
    mocks.limit.mockResolvedValue([adminUser]);

    const result = await requireAdmin();

    expect(result).toEqual(adminUser);
  });
});
