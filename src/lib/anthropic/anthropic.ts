import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "langsmith/wrappers/anthropic";

export const anthropic = wrapAnthropic(new Anthropic());

export const CHAT_MODEL = "claude-sonnet-5";

// Fast/cheap model used for the guardrail classifier (see @/lib/guardrails) —
// kept separate from CHAT_MODEL so guardrail checks stay low-latency and low-cost.
export const GUARDRAIL_MODEL = "claude-haiku-4-5-20251001";
