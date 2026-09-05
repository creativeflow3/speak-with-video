import { describe, it, expect, vi } from "vitest";
import { toolDispatcher, type ChatTurnInput } from "./toolDispatcher";

function fakeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          return i < items.length ? { value: items[i++], done: false } : { value: undefined, done: true };
        },
      };
    },
  };
}

const mocks = vi.hoisted(() => ({ toolRunner: vi.fn() }));

vi.mock("@/lib/anthropic", () => ({
  anthropic: { beta: { messages: { toolRunner: mocks.toolRunner } } },
  CHAT_MODEL: "claude-sonnet-5",
}));
vi.mock("langsmith/traceable", () => ({ traceable: (fn: unknown) => fn }));

function baseInput(overrides: Partial<ChatTurnInput> = {}): ChatTurnInput {
  return {
    query: "hola",
    history: [],
    userId: "user-1",
    enqueue: vi.fn(),
    pendingExports: [],
    toolContext: { userId: "user-1", onExport: vi.fn() },
    ...overrides,
  };
}

const textDelta = (text: string) => ({
  type: "content_block_delta",
  delta: { type: "text_delta", text },
});

describe("toolDispatcher", () => {
  it("streams text deltas via enqueue and accumulates the full response", async () => {
    mocks.toolRunner.mockReturnValue(
      fakeAsyncIterable([fakeAsyncIterable([textDelta("Hola"), textDelta(" mundo")])]),
    );
    const input = baseInput();

    const result = await toolDispatcher(input);

    expect(result.responseText).toBe("Hola mundo");
    expect(input.enqueue).toHaveBeenCalledWith(expect.stringContaining("Hola"));
  });

  it("drains pendingExports after each message stream and reports them in exportedEvents", async () => {
    const pendingExports: ChatTurnInput["pendingExports"] = [];
    mocks.toolRunner.mockReturnValue(
      fakeAsyncIterable([
        fakeAsyncIterable([{ type: "noop" }]), // triggers a drain check with nothing queued yet
      ]),
    );
    // Simulate a tool call queuing an export before the messageStream is iterated.
    pendingExports.push({ event: "anki_csv", data: { csv: "a,b", cardCount: 1 } });
    const input = baseInput({ pendingExports });

    const result = await toolDispatcher(input);

    expect(result.exportedEvents).toEqual(["anki_csv"]);
    expect(input.enqueue).toHaveBeenCalledWith(expect.stringContaining("anki_csv"));
  });

  it("passes model, tools, max_iterations, and the full message history to toolRunner", async () => {
    mocks.toolRunner.mockReturnValue(fakeAsyncIterable([]));
    const input = baseInput({ history: [{ role: "user", content: "prior" }], query: "new query" });

    await toolDispatcher(input);

    expect(mocks.toolRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        max_iterations: 8,
        stream: true,
        messages: [{ role: "user", content: "prior" }, { role: "user", content: "new query" }],
      }),
    );
  });

  it("ignores non-text-delta events", async () => {
    mocks.toolRunner.mockReturnValue(
      fakeAsyncIterable([fakeAsyncIterable([{ type: "content_block_start" }])]),
    );
    const input = baseInput();

    const result = await toolDispatcher(input);

    expect(result.responseText).toBe("");
    expect(input.enqueue).not.toHaveBeenCalled();
  });
});
