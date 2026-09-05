import { NextResponse } from "next/server";
import { parseVideoId, isYouTubeUrl, youtubeUrlFromId } from "@/lib/youtube";
import { isSupportedLanguage } from "@/lib/languages";
import { log } from "@/lib/logger";
import { requireSession } from "@/lib/authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import {
  findVideoByVideoId,
  createVideo,
  markVideoPending,
  markVideoFailed,
} from "@/services/ingest.service";
import { videoIngest, IngestValidationError } from "@/lib/video-ingest";
import type { IngestRequestBody } from "@/types";

// Transcript fetch (with retries), oembed, embeddings, and the Pinecone upsert
// run sequentially and can add up past Vercel's default function timeout —
// that shows up client-side as a non-JSON response, i.e. the generic "network
// error" in IngestForm. 60s is the max allowed on Vercel's Hobby tier.
export const maxDuration = 60;

async function failIngest(videoId: string, reason: string, status: number) {
  await markVideoFailed(videoId, reason);
  log("ingest_failed", { videoId, reason });
  return NextResponse.json({ error: reason }, { status });
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await checkRateLimit(auth.id, RATE_LIMITS.ingest);
  if (limited) return limited;

  let body: Partial<IngestRequestBody>;
  try {
    body = (await request.json()) as Partial<IngestRequestBody>;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.youtubeUrl || !body.language) {
    return NextResponse.json(
      { error: "youtubeUrl and language are required" },
      { status: 400 },
    );
  }
  const language = body.language;

  if (!isSupportedLanguage(language)) {
    return NextResponse.json(
      { error: `Unsupported language "${language}"` },
      { status: 400 },
    );
  }

  if (!isYouTubeUrl(body.youtubeUrl)) {
    return NextResponse.json(
      { error: "Only YouTube URLs are supported" },
      { status: 400 },
    );
  }

  const videoId = parseVideoId(body.youtubeUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not parse a YouTube video ID from that URL" },
      {
        status: 400,
      },
    );
  }

  const youtubeUrl = youtubeUrlFromId(videoId);

  const existing = await findVideoByVideoId(videoId);
  if (existing?.status === "succeeded") {
    return NextResponse.json({ status: "already_ingested", video: existing });
  }

  // Ownership is set once, at creation — a retry of an existing (failed/pending) video
  // must not silently reassign it to whoever happens to trigger the retry.
  const ownerId = existing?.ownerId ?? auth.id;
  const visibility =
    existing?.visibility ?? (auth.role === "Admin" ? "base" : "private");

  log("ingest_started", { videoId, language });

  if (existing) {
    await markVideoPending(videoId, language);
  } else {
    await createVideo({ videoId, youtubeUrl, language, ownerId, visibility });
  }

  try {
    const result = await videoIngest({
      videoId,
      youtubeUrl,
      language,
      ownerId,
      visibility,
      titleOverride: body.titleOverride,
      channelOverride: body.channelOverride,
    });

    return NextResponse.json({ status: "succeeded", ...result });
  } catch (err) {
    if (err instanceof IngestValidationError) {
      return failIngest(videoId, err.message, err.status);
    }
    const reason =
      err instanceof Error
        ? err.message
        : "Unknown error while processing transcript";
    return failIngest(videoId, reason, 500);
  }
}
