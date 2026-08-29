const BASE_URL = "https://transcriptapi.com/api/v2/youtube/transcript";

import type { TranscriptSegment, TranscriptResult } from "./types";

export class TranscriptApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TranscriptApiError";
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

async function requestTranscript(
  videoIdOrUrl: string,
  language: string,
  apiKey: string,
): Promise<TranscriptResult> {
  const url = new URL(BASE_URL);
  url.searchParams.set("video_url", videoIdOrUrl);
  url.searchParams.set("send_metadata", "true");
  url.searchParams.set("language", `${language},asr-${language}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | { message?: string };
      code?: string;
    };
    const message =
      typeof body.detail === "string"
        ? body.detail
        : (body.detail?.message ??
          `transcriptapi.com request failed (${res.status})`);
    throw new TranscriptApiError(
      message,
      body.code ?? "unknown_error",
      res.status,
    );
  }

  const data = (await res.json()) as {
    transcript: TranscriptSegment[];
    metadata?: { title?: string; author_name?: string };
  };

  return {
    segments: data.transcript,
    title: data.metadata?.title ?? null,
    channel: data.metadata?.author_name ?? null,
  };
}

/**
 * Fetch a transcript for a video, requesting creator captions in `language`
 * first and falling back to auto-generated captions in the same language.
 * Retries on failure: transcriptapi.com can transiently report a video's
 * captions as unavailable on the first request before they're cached.
 */
export async function fetchTranscript(
  videoIdOrUrl: string,
  language: string,
): Promise<TranscriptResult> {
  const apiKey = process.env.TRANSCRIPTAPI_KEY;
  if (!apiKey) throw new Error("TRANSCRIPTAPI_KEY is not set");

  for (let attempt = 1; ; attempt++) {
    try {
      return await requestTranscript(videoIdOrUrl, language, apiKey);
    } catch (err) {
      if (!(err instanceof TranscriptApiError) || attempt === MAX_ATTEMPTS)
        throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
