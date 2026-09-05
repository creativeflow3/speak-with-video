import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "./logger";

describe("log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a single JSON line with the event name, an ISO timestamp, and extra data", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("ingest_started", { videoId: "abc123" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.event).toBe("ingest_started");
    expect(parsed.videoId).toBe("abc123");
    expect(new Date(parsed.time).toISOString()).toBe(parsed.time);
  });

  it("defaults to no extra data", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    log("tool_call");

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(Object.keys(parsed).sort()).toEqual(["event", "time"]);
  });
});
