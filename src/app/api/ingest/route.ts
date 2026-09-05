import { NextResponse } from "next/server";
import { traceable } from "langsmith/traceable";
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

// Thrown for expected, business-logic failures partway through `runIngest` (bad
// language match, empty transcript, etc.) so they show up in the LangSmith trace
// as an error on that step rather than being swallowed by an early return.
class IngestValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "IngestValidationError";
  }
}

// Each wrapped as its own LangSmith "tool" span so a production failure shows
// exactly which external call failed or timed out (transcriptapi.com, YouTube
// oembed, Voyage, Pinecone) instead of just "network error" in the browser.
const tracedFetchTranscript = traceable(fetchTranscript, {
  name: "fetch_transcript",
  run_type: "tool",
});
const tracedFetchOEmbed = traceable(fetchOEmbed, {
  name: "fetch_oembed",
  run_type: "tool",
});
const tracedEmbedDocuments = traceable(embedDocuments, {
  name: "embed_documents",
  run_type: "tool",
});
const tracedUpsertChunks = traceable(upsertChunks, {
  name: "upsert_chunks",
  run_type: "tool",
});

async function failIngest(videoId: string, reason: string, status: number) {
  await markVideoFailed(videoId, reason);
  log("ingest_failed", { videoId, reason });
  return NextResponse.json({ error: reason }, { status });
}

interface RunIngestInput {
  videoId: string;
  youtubeUrl: string;
  language: string;
  ownerId: string;
  visibility: "base" | "private";
  titleOverride?: string;
  channelOverride?: string;
}

// Parent LangSmith trace for one ingest request; the tool spans above nest
// under it, giving a single trace per upload with per-step timing and errors.
const runIngest = traceable(
  async ({
    videoId,
    youtubeUrl,
    language,
    ownerId,
    visibility,
    titleOverride,
    channelOverride,
  }: RunIngestInput) => {
    let transcript;
    try {
      transcript = await tracedFetchTranscript(videoId, language);
      await recordTranscriptApiUsage(videoId, true);
    } catch (err) {
      await recordTranscriptApiUsage(videoId, false);
      const reason =
        err instanceof TranscriptApiError
          ? err.message
          : "Unknown transcript fetch error";
      throw new IngestValidationError(reason, 422);
    }

    const languageCheck = checkTranscriptLanguage(
      sampleForLanguageCheck(transcript.segments),
      language,
    );
    if (!languageCheck.matches) {
      throw new IngestValidationError(
        `Transcript appears to be in "${languageCheck.detected}", not the requested "${language}"`,
        422,
      );
    }

    let title = transcript.title ?? titleOverride ?? null;
    let channel = transcript.channel ?? channelOverride ?? null;
    if (!title || !channel) {
      const oembed = await tracedFetchOEmbed(youtubeUrl);
      title = title ?? oembed?.title ?? titleOverride ?? "";
      channel = channel ?? oembed?.channel ?? channelOverride ?? "";
    }

    const chunks = chunkTranscript(transcript.segments);
    if (chunks.length === 0) {
      throw new IngestValidationError(
        "Transcript was empty after chunking",
        422,
      );
    }

    const vectors = await tracedEmbedDocuments(chunks.map((c) => c.text));

    await tracedUpsertChunks(
      chunks.map((chunk, i) => {
        const metadata: ChunkMetadata = {
          videoId,
          youtubeUrl,
          language,
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

    return { videoId, chunkCount: chunks.length, title, channel };
  },
  {
    name: "ingest_video",
    run_type: "chain",
    processInputs: ({ videoId, language, ownerId, visibility }: RunIngestInput) => ({
      videoId,
      language,
      ownerId,
      visibility,
    }),
  },
);

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
    const result = await runIngest({
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
