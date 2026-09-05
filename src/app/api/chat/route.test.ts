import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { toolDispatcher } from "@/lib/tool-dispatcher";
import { makeAuthedUser, makeJsonRequest } from "../testUtils";
import { POST } from "./route";
import type { ChatTurnInput } from "@/lib/tool-dispatcher/toolDispatcher";

vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMITS: { chat: { route: "chat" } },
}));
vi.mock("@/lib/tool-dispatcher", () => ({ toolDispatcher: vi.fn() }));

const user = makeAuthedUser();

function makeRequest(body: unknown): Request {
  return makeJsonRequest("/api/chat", body);
}

function lastCallInput(): ChatTurnInput {
  return vi.mocked(toolDispatcher).mock.calls[0][0] as unknown as ChatTurnInput;
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(user);
  vi.mocked(checkRateLimit).mockResolvedValue(null);
  vi.mocked(toolDispatcher).mockResolvedValue({ responseText: "", exportedEvents: [] });
});

describe("POST /api/chat", () => {
  it("returns the 401 from requireSession without touching rate limiting", async () => {
    const unauthed = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    const res = await POST(makeRequest({ query: "hola" }));

    expect(res).toBe(unauthed);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns the 429 from checkRateLimit", async () => {
    const limited = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    vi.mocked(checkRateLimit).mockResolvedValue(limited);

    const res = await POST(makeRequest({ query: "hola" }));

    expect(res).toBe(limited);
    expect(toolDispatcher).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be valid JSON" });
  });

  it("returns 400 when query is missing", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "query is required" });
  });

  it("responds with SSE headers", async () => {
    const res = await POST(makeRequest({ query: "hola" }));

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("passes the query, userId, and an empty history through to toolDispatcher", async () => {
    await readStream(await POST(makeRequest({ query: "hola" })));

    expect(toolDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ query: "hola", userId: "user-1", history: [] }),
    );
  });

  it("maps message history to role/content and drops extra fields", async () => {
    await readStream(
      await POST(
        makeRequest({
          query: "hola",
          messages: [{ role: "user", content: "hi", extra: "drop me" }],
        }),
      ),
    );

    expect(toolDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ history: [{ role: "user", content: "hi" }] }),
    );
  });

  it("truncates history to the most recent 20 messages", async () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: "user" as const,
      content: `msg-${i}`,
    }));

    await readStream(await POST(makeRequest({ query: "hola", messages })));

    const call = lastCallInput();
    expect(call.history).toHaveLength(20);
    expect(call.history[0]).toEqual({ role: "user", content: "msg-5" });
    expect(call.history[19]).toEqual({ role: "user", content: "msg-24" });
  });

  it("streams a done event once toolDispatcher resolves", async () => {
    const body = await readStream(await POST(makeRequest({ query: "hola" })));

    expect(body).toContain("event: done");
  });

  it.each([
    ["an Error", new Error("dispatcher exploded"), "dispatcher exploded"],
    ["a non-Error", "nope", "Unknown error"],
  ])("streams an error event when toolDispatcher rejects with %s", async (_case, rejection, expected) => {
    vi.mocked(toolDispatcher).mockRejectedValue(rejection);

    const body = await readStream(await POST(makeRequest({ query: "hola" })));

    expect(body).toContain("event: error");
    expect(body).toContain(expected);
    expect(body).not.toContain("event: done");
  });

  it("gives toolDispatcher an enqueue function and a mutable pendingExports/toolContext pair", async () => {
    await readStream(await POST(makeRequest({ query: "hola" })));

    const call = lastCallInput();
    expect(typeof call.enqueue).toBe("function");
    expect(call.pendingExports).toEqual([]);
    expect(call.toolContext.userId).toBe("user-1");
    expect(typeof call.toolContext.onExport).toBe("function");
  });
});
