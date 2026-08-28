import { describe, it, expect } from "vitest";
import { isYouTubeUrl, parseVideoId } from "./youtube";

describe("isYouTubeUrl", () => {
  it("accepts a bare 11-character video ID", () => {
    expect(isYouTubeUrl("dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts youtube.com, www.youtube.com, m.youtube.com, and youtu.be", () => {
    expect(isYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects a spoofed hostname that merely ends with 'youtube.com'", () => {
    expect(isYouTubeUrl("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isYouTubeUrl("https://evilyoutube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });

  it("rejects an unrelated host", () => {
    expect(isYouTubeUrl("https://vimeo.com/12345")).toBe(false);
  });

  it("rejects a non-URL string that isn't a bare video ID", () => {
    expect(isYouTubeUrl("not a url")).toBe(false);
  });
});

describe("parseVideoId", () => {
  it("extracts the id from a spoofed youtube-lookalike hostname as null", () => {
    expect(parseVideoId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
