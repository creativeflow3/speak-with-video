import { NextResponse } from "next/server";
import {
  parseVideoId,
  isYouTubeUrl,
  fetchOEmbed,
  youtubeUrlFromId,
} from "@/lib/youtube";
import {
  fetchTranscript,
  TranscriptApiError,
} from "@/lib/transcript/transcriptapi";
import { chunkTranscript } from "@/lib/transcript/chunk";
import {
  checkTranscriptLanguage,
  sampleForLanguageCheck,
} from "@/lib/transcript/language";
import { isSupportedLanguage } from "@/lib/languages";
import { embedDocuments } from "@/lib/voyage";
import { upsertChunks, type ChunkMetadata } from "@/lib/pinecone";
import { log } from "@/lib/logger";
import { requireSession } from "@/lib/authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import {
  findVideoByVideoId,
  createVideo,
  markVideoPending,
  markVideoFailed,
  markVideoSucceeded,
  recordTranscriptApiUsage,
} from "@/services/ingest.service";
import type { IngestRequestBody } from "@/types";

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

  if (!isSupportedLanguage(body.language)) {
    return NextResponse.json(
      { error: `Unsupported language "${body.language}"` },
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

  log("ingest_started", { videoId, language: body.language });

  if (existing) {
    await markVideoPending(videoId, body.language);
  } else {
    await createVideo({ videoId, youtubeUrl, language: body.language, ownerId, visibility });
  }

  let transcript;
  try {
    transcript = await fetchTranscript(videoId, body.language);
    await recordTranscriptApiUsage(videoId, true);
  } catch (err) {
    await recordTranscriptApiUsage(videoId, false);
    const reason =
      err instanceof TranscriptApiError
        ? err.message
        : "Unknown transcript fetch error";
    return failIngest(videoId, reason, 422);
  }

  const languageCheck = checkTranscriptLanguage(
    sampleForLanguageCheck(transcript.segments),
    body.language,
  );
  if (!languageCheck.matches) {
    return failIngest(
      videoId,
      `Transcript appears to be in "${languageCheck.detected}", not the requested "${body.language}"`,
      422,
    );
  }

  try {
    let title = transcript.title ?? body.titleOverride ?? null;
    let channel = transcript.channel ?? body.channelOverride ?? null;
    if (!title || !channel) {
      const oembed = await fetchOEmbed(youtubeUrl);
      title = title ?? oembed?.title ?? body.titleOverride ?? "";
      channel = channel ?? oembed?.channel ?? body.channelOverride ?? "";
    }

    const chunks = chunkTranscript(transcript.segments);
    if (chunks.length === 0) {
      return failIngest(videoId, "Transcript was empty after chunking", 422);
    }

    const vectors = await embedDocuments(chunks.map((c) => c.text));

    await upsertChunks(
      chunks.map((chunk, i) => {
        const metadata: ChunkMetadata = {
          videoId,
          youtubeUrl,
          language: body.language!,
          channel: channel ?? "",
          videoTitle: title ?? "",
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          ownerId,
          visibility,
        };
        return { vector: vectors[i], metadata };
      }),
    );

    await markVideoSucceeded(videoId, { title, channel, chunkCount: chunks.length });

    log("ingest_succeeded", { videoId, chunkCount: chunks.length });

    return NextResponse.json({
      status: "succeeded",
      videoId,
      chunkCount: chunks.length,
      title,
      channel,
    });
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.message
        : "Unknown error while processing transcript";
    return failIngest(videoId, reason, 500);
  }
}
