import { describe, it, expect } from "vitest";
import { parseSseChunk } from "./utils";

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
