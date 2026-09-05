import { traceable } from "langsmith/traceable";
import { fetchOEmbed } from "@/lib/youtube";
import {
  fetchTranscript,
  TranscriptApiError,
} from "@/lib/transcript/transcriptapi";
import { chunkTranscript } from "@/lib/transcript/chunk";
import {
  checkTranscriptLanguage,
  sampleForLanguageCheck,
} from "@/lib/transcript/language";
import { embedDocuments } from "@/lib/voyage";
import { upsertChunks, type ChunkMetadata } from "@/lib/pinecone";
import { log } from "@/lib/logger";
import {
  markVideoSucceeded,
  recordTranscriptApiUsage,
} from "@/services/ingest.service";

// Thrown for expected, business-logic failures partway through `videoIngest` (bad
// language match, empty transcript, etc.) so they show up in the LangSmith trace
// as an error on that step rather than being swallowed by an early return.
export class IngestValidationError extends Error {
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

export interface VideoIngestInput {
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
export const videoIngest = traceable(
  async ({
    videoId,
    youtubeUrl,
    language,
    ownerId,
    visibility,
    titleOverride,
    channelOverride,
  }: VideoIngestInput) => {
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
    processInputs: ({ videoId, language, ownerId, visibility }: VideoIngestInput) => ({
      videoId,
      language,
      ownerId,
      visibility,
    }),
  },
);
