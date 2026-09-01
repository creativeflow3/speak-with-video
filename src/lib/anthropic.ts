import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "langsmith/wrappers/anthropic";

export const anthropic = wrapAnthropic(new Anthropic());

export const CHAT_MODEL = "claude-sonnet-5";
