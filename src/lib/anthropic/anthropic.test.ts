import { describe, it, expect } from "vitest";
import { anthropic, CHAT_MODEL, GUARDRAIL_MODEL } from "./anthropic";

describe("anthropic client", () => {
  it("exports the configured chat model", () => {
    expect(CHAT_MODEL).toBe("claude-sonnet-5");
  });

  it("exports the configured guardrail model", () => {
    expect(GUARDRAIL_MODEL).toBe("claude-haiku-4-5-20251001");
  });

  it("exports a LangSmith-traced Anthropic-like client", () => {
    expect(typeof anthropic.messages.create).toBe("function");
    expect(typeof anthropic.beta.messages.toolRunner).toBe("function");
  });
});
