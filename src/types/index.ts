export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SseFrame {
  event: string;
  data: string;
}
