import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "./rateLimit";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { insert, values, returning };
});

vi.mock("@/db", () => ({ db: { insert: mocks.insert } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  mocks.values.mockClear();
  mocks.returning.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows the request and returns null when under the limit", async () => {
    mocks.returning.mockResolvedValue([{ count: 5, windowStart: new Date() }]);

    expect(await checkRateLimit("user-1", RATE_LIMITS.chat)).toBeNull();
  });

  it("allows the request when count exactly equals the limit", async () => {
    mocks.returning.mockResolvedValue([{ count: RATE_LIMITS.chat.limit, windowStart: new Date() }]);

    expect(await checkRateLimit("user-1", RATE_LIMITS.chat)).toBeNull();
  });

  it("rejects with a 429 when the count exceeds the limit", async () => {
    mocks.returning.mockResolvedValue([{ count: RATE_LIMITS.chat.limit + 1, windowStart: new Date() }]);

    const result = await checkRateLimit("user-1", RATE_LIMITS.chat);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(429);
  });

  it("sets a Retry-After header matching the remaining window time", async () => {
    const windowStart = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date(windowStart.getTime() + 60_000)); // 1 minute into a 5-minute window
    mocks.returning.mockResolvedValue([{ count: RATE_LIMITS.chat.limit + 1, windowStart }]);

    const result = (await checkRateLimit("user-1", RATE_LIMITS.chat)) as NextResponse;

    expect(result.headers.get("Retry-After")).toBe("240"); // 5 min window - 1 min elapsed
  });

  it("floors Retry-After at 1 second even if the window already elapsed", async () => {
    const windowStart = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date(windowStart.getTime() + 10 * 60_000)); // past the 5-minute window
    mocks.returning.mockResolvedValue([{ count: RATE_LIMITS.chat.limit + 1, windowStart }]);

    const result = (await checkRateLimit("user-1", RATE_LIMITS.chat)) as NextResponse;

    expect(result.headers.get("Retry-After")).toBe("1");
  });

  it("passes the userId and route through to the upsert", async () => {
    mocks.returning.mockResolvedValue([{ count: 1, windowStart: new Date() }]);

    await checkRateLimit("user-42", RATE_LIMITS.ingest);

    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-42", route: "ingest", count: 1 }),
    );
  });

  it("keeps chat and ingest limits independent", async () => {
    mocks.returning.mockResolvedValue([{ count: 1, windowStart: new Date() }]);

    await checkRateLimit("user-1", RATE_LIMITS.chat);
    await checkRateLimit("user-1", RATE_LIMITS.ingest);

    expect(mocks.values).toHaveBeenNthCalledWith(1, expect.objectContaining({ route: "chat" }));
    expect(mocks.values).toHaveBeenNthCalledWith(2, expect.objectContaining({ route: "ingest" }));
  });
});
