// Type-only, so none of the server-side db code reaches the client bundle.
import type { OwnedVideo } from "@/services/ingest.service";
import type { PageSize } from "@/lib/pagination";

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  query: string;
  messages?: ChatRequestMessage[];
  /** The vocabulary list `add_to_list` / `download_list` act on; the server falls back to Default. */
  listId?: string;
}

/** A dashboard video as JSON: like OwnedVideo, but `createdAt` arrives as an ISO string. */
export type OwnedVideoJson = Omit<OwnedVideo, "createdAt"> & { createdAt: string };

export interface VideosPageResponse {
  videos: OwnedVideoJson[];
  page: number;
  limit: PageSize;
  total: number;
  totalPages: number;
}

export interface IngestRequestBody {
  youtubeUrl: string;
  language: string;
  titleOverride?: string;
  channelOverride?: string;
}
