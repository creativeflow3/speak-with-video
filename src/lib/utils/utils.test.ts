import { describe, it, expect } from "vitest";
import { isUuid, parseSseChunk, pluralize } from "./utils";

describe("pluralize", () => {
  it.each([
    [0, "0 words"],
    [1, "1 word"],
    [2, "2 words"],
  ])("%i → %s", (count, expected) => {
    expect(pluralize(count, "word")).toBe(expected);
  });

  it("uses an explicit plural form", () => {
    expect(pluralize(2, "entry", "entries")).toBe("2 entries");
  });
});

describe("isUuid", () => {
  it("accepts a v4 uuid", () => {
    expect(isUuid("6f1c2b0e-8a4d-4c1e-9f3a-2b7d5e8c9a10")).toBe(true);
  });

  it.each([["not-a-uuid"], [""], [42], [undefined]])("rejects %j", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});

describe("parseSseChunk", () => {
  it("parses a single complete frame", () => {
    const { frames, rest } = parseSseChunk('event: text\ndata: {"text":"hi"}\n\n');
    expect(frames).toEqual([{ event: "text", data: '{"text":"hi"}' }]);
    expect(rest).toBe("");
  });

  it("parses multiple frames in one buffer", () => {
    const buffer = 'event: text\ndata: one\n\nevent: done\ndata: {}\n\n';
    const { frames, rest } = parseSseChunk(buffer);
    expect(frames).toEqual([
      { event: "text", data: "one" },
      { event: "done", data: "{}" },
    ]);
    expect(rest).toBe("");
  });

  it("defaults to event 'message' when no event line is present", () => {
    const { frames } = parseSseChunk("data: hello\n\n");
    expect(frames).toEqual([{ event: "message", data: "hello" }]);
  });

  it("skips a frame with no data line", () => {
    const { frames } = parseSseChunk("event: ping\n\n");
    expect(frames).toEqual([]);
  });

  it("returns an incomplete trailing chunk as rest instead of a frame", () => {
    const { frames, rest } = parseSseChunk('event: text\ndata: one\n\nevent: text\ndata: partial');
    expect(frames).toEqual([{ event: "text", data: "one" }]);
    expect(rest).toBe("event: text\ndata: partial");
  });

  it("returns no frames and the whole buffer as rest when nothing is complete yet", () => {
    const { frames, rest } = parseSseChunk("event: text\ndata: partial");
    expect(frames).toEqual([]);
    expect(rest).toBe("event: text\ndata: partial");
  });
});
