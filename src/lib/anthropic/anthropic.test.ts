import { describe, it, expect } from "vitest";
import { anthropic, CHAT_MODEL } from "./anthropic";

describe("anthropic client", () => {
  it("exports the configured chat model", () => {
    expect(CHAT_MODEL).toBe("claude-sonnet-5");
  });

  it("exports a LangSmith-traced Anthropic-like client", () => {
    expect(typeof anthropic.messages.create).toBe("function");
    expect(typeof anthropic.beta.messages.toolRunner).toBe("function");
  });
});
