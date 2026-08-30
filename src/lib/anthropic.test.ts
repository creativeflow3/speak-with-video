import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_MODEL } from "./anthropic";

describe("anthropic client", () => {
  it("exports the configured chat model", () => {
    expect(CHAT_MODEL).toBe("claude-sonnet-5");
  });

  it("exports an Anthropic client instance", () => {
    expect(anthropic).toBeInstanceOf(Anthropic);
  });
});
