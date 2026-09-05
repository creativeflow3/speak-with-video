import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export interface RateLimitConfig {
  route: string;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.windowSeconds * 1000);

  const [row] = await db
    .insert(rateLimits)
    .values({ userId, route: config.route, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.userId, rateLimits.route],
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${cutoff.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (row.count <= config.limit) return null;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((row.windowStart.getTime() + config.windowSeconds * 1000 - now.getTime()) / 1000),
  );
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly.", retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

const CHAT_RATE_LIMIT = 20;
const CHAT_LIMIT_WINDOW = 5 * 60;
const INGEST_RATE_LIMIT = 15;
const INGEST_LIMIT_WINDOW = 60 * 60;

export const RATE_LIMITS = {
  chat: { route: "chat", limit: CHAT_RATE_LIMIT, windowSeconds: CHAT_LIMIT_WINDOW },
  ingest: { route: "ingest", limit: INGEST_RATE_LIMIT, windowSeconds: INGEST_LIMIT_WINDOW },
} as const satisfies Record<string, RateLimitConfig>;
