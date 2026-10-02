type LogEvent =
  | "ingest_started"
  | "ingest_succeeded"
  | "ingest_failed"
  | "rag_query"
  | "rerank_failed"
  | "tool_call"
  | "anki_export"
  | "list_add"
  | "list_download"
  | "guardrail_blocked"
  | "guardrail_check_failed";

export function log(event: LogEvent, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      event,
      time: new Date().toISOString(),
      ...data,
    }),
  );
}
