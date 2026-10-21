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

export interface IngestRequestBody {
  youtubeUrl: string;
  language: string;
  titleOverride?: string;
  channelOverride?: string;
}
