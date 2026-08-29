type LogEvent =
  | "ingest_started"
  | "ingest_succeeded"
  | "ingest_failed"
  | "rag_query"
  | "tool_call"
  | "anki_export"
  | "list_add"
  | "list_download";

export function log(event: LogEvent, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      event,
      time: new Date().toISOString(),
      ...data,
    }),
  );
}
