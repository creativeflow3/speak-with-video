interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  query: string;
  messages?: ChatRequestMessage[];
}

export interface IngestRequestBody {
  youtubeUrl: string;
  language: string;
  titleOverride?: string;
  channelOverride?: string;
}
