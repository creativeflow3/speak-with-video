import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestPasswordChange } from "@/lib/auth0-account";
import { unauthedResponse, makeAuthedUser } from "../../testUtils";
import { POST } from "./route";

vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMITS: { passwordReset: { route: "password_reset" } },
}));
vi.mock("@/lib/auth0-account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth0-account")>()),
  requestPasswordChange: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
  vi.mocked(checkRateLimit).mockResolvedValue(null);
  vi.mocked(requestPasswordChange).mockResolvedValue(undefined);
});

describe("POST /api/account/password-reset", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await POST()).toBe(unauthed);
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it("rejects social-login users with 400 without spending their rate limit", async () => {
    vi.mocked(requireSession).mockResolvedValue(makeAuthedUser({ auth0Sub: "google-oauth2|1" }));

    const res = await POST();

    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it("returns the 429 from checkRateLimit", async () => {
    const limited = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    vi.mocked(checkRateLimit).mockResolvedValue(limited);

    expect(await POST()).toBe(limited);
    expect(checkRateLimit).toHaveBeenCalledWith("user-1", { route: "password_reset" });
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it("sends the reset email to the session's email", async () => {
    const res = await POST();

    expect(requestPasswordChange).toHaveBeenCalledWith("a@b.com");
    expect(await res.json()).toEqual({ sent: true });
  });

  it("returns 502 when Auth0 fails", async () => {
    vi.mocked(requestPasswordChange).mockRejectedValue(new Error("Auth0 returned 500"));

    const res = await POST();

    expect(res.status).toBe(502);
  });
});
