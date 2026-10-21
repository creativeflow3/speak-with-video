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
  | "list_created"
  | "list_deleted"
  | "list_cleared"
  | "list_item_deleted"
  | "password_reset_requested"
  | "route_error"
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

/** Logs an unexpected error caught at a route or page boundary. */
export function logRouteError(route: string, err: unknown) {
  log("route_error", { route, message: err instanceof Error ? err.message : String(err) });
}
