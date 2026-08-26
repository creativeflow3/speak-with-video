import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, transcriptApiUsage } from "@/db/schema";
import { parseVideoId, fetchOEmbed, youtubeUrlFromId } from "@/lib/youtube";
import { fetchTranscript, TranscriptApiError } from "@/lib/transcript/transcriptapi";
import { chunkTranscript } from "@/lib/transcript/chunk";
import { embedDocuments } from "@/lib/voyage";
import { upsertChunks, type ChunkMetadata } from "@/lib/pinecone";
import { log } from "@/lib/logger";
import { requireSession } from "@/lib/authz";

interface IngestRequestBody {
  youtubeUrl: string;
  language: string;
  titleOverride?: string;
  channelOverride?: string;
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  let body: Partial<IngestRequestBody>;
  try {
    body = (await request.json()) as Partial<IngestRequestBody>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body.youtubeUrl || !body.language) {
    return NextResponse.json(
      { error: "youtubeUrl and language are required" },
      { status: 400 },
    );
  }

  const videoId = parseVideoId(body.youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Could not parse a YouTube video ID from that URL" }, {
      status: 400,
    });
  }

  const youtubeUrl = youtubeUrlFromId(videoId);

  const [existing] = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
  if (existing?.status === "succeeded") {
    return NextResponse.json({ status: "already_ingested", video: existing });
  }

  // Ownership is set once, at creation — a retry of an existing (failed/pending) video
  // must not silently reassign it to whoever happens to trigger the retry.
  const ownerId = existing?.ownerId ?? auth.id;
  const visibility = existing?.visibility ?? (auth.role === "Admin" ? "base" : "private");

  log("ingest_started", { videoId, language: body.language });

  if (existing) {
    await db
      .update(videos)
      .set({ status: "pending", language: body.language, failureReason: null })
      .where(eq(videos.videoId, videoId));
  } else {
    await db.insert(videos).values({
      videoId,
      youtubeUrl,
      language: body.language,
      status: "pending",
      ownerId,
      visibility,
    });
  }

  let transcript;
  try {
    transcript = await fetchTranscript(videoId, body.language);
    await db.insert(transcriptApiUsage).values({ videoId, succeeded: true });
  } catch (err) {
    await db.insert(transcriptApiUsage).values({ videoId, succeeded: false });
    const reason = err instanceof TranscriptApiError ? err.message : "Unknown transcript fetch error";
    await db.update(videos).set({ status: "failed", failureReason: reason }).where(eq(videos.videoId, videoId));
    log("ingest_failed", { videoId, reason });
    return NextResponse.json({ error: reason }, { status: 422 });
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
      const reason = "Transcript was empty after chunking";
      await db.update(videos).set({ status: "failed", failureReason: reason }).where(eq(videos.videoId, videoId));
      log("ingest_failed", { videoId, reason });
      return NextResponse.json({ error: reason }, { status: 422 });
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

    await db
      .update(videos)
      .set({ status: "succeeded", title, channel, chunkCount: chunks.length, failureReason: null })
      .where(eq(videos.videoId, videoId));

    log("ingest_succeeded", { videoId, chunkCount: chunks.length });

    return NextResponse.json({ status: "succeeded", videoId, chunkCount: chunks.length, title, channel });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error while processing transcript";
    await db.update(videos).set({ status: "failed", failureReason: reason }).where(eq(videos.videoId, videoId));
    log("ingest_failed", { videoId, reason });
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
