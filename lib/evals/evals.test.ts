/**
 * End-to-end eval — calls the REAL /api/chat route (real HTTP, real tool
 * calls against Pinecone/Postgres), then has Claude judge the prose parts
 * against plain-English criteria. Structural claims (did the anki_csv tool
 * actually fire, is the CSV parseable) are checked directly, not judged.
 *
 *   Start the app first — this posts to it over HTTP, the same request the
 *   browser makes, through the whole pipeline: chat route -> tool runner ->
 *   search_rag / generate_anki_csv -> Pinecone / Voyage.
 *
 *     npm run dev          (in one terminal)
 *     npm run test:evals   (in another)
 *
 *   Requires at least one video already ingested. Set EVAL_KNOWN_PHRASE to a
 *   phrase you know appears in an ingested video for the "known phrase" case
 *   to be meaningful (defaults to "vale la pena" — ingest a video containing
 *   it, or override the env var).
 *
 * Why a judge? The answer is prose — "vale la pena" gets cited a dozen
 * different ways depending on phrasing, and no toBe()/toContain() covers
 * every valid answer. So we state what a good answer must DO, and a second
 * model checks it.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
const KNOWN_PHRASE = process.env.EVAL_KNOWN_PHRASE ?? "vale la pena";
const NEVER_INGESTED_PHRASE = "supercalifragilisticexpialidocious en español";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnkiExport {
  csv: string;
  cardCount: number;
}

interface ChatResult {
  text: string;
  ankiCsv: AnkiExport | null;
}

/** POST /api/chat over real HTTP and collect its SSE stream into plain text + any anki_csv payload. */
async function askChat(query: string, messages: ChatMessage[] = []): Promise<ChatResult> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, messages }),
  }).catch(() => {
    throw new Error(
      `Could not reach ${BASE_URL}. Start the app first:  npm run dev\n` +
        `(different port? EVAL_BASE_URL=http://localhost:3001 npm run test:evals)`,
    );
  });

  expect(res.status).toBe(200);
  const raw = await res.text();

  let text = "";
  let ankiCsv: AnkiExport | null = null;

  for (const part of raw.split("\n\n")) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice("event: ".length);
      if (line.startsWith("data: ")) data = line.slice("data: ".length);
    }
    if (!data) continue;
    if (event === "text") text += (JSON.parse(data) as { text: string }).text;
    if (event === "anki_csv") ankiCsv = JSON.parse(data) as AnkiExport;
  }

  return { text, ankiCsv };
}

const VerdictSchema = z.object({
  pass: z.boolean().describe("true only if EVERY criterion is met"),
  reasoning: z
    .string()
    .describe("One sentence. Name the criterion that failed, if any."),
});

/** Grade an answer against plain-English criteria, using Claude as the judge. */
async function judge(query: string, answer: string, criteria: string[]) {
  const message = await anthropic.messages.parse({
    // A cheap judge that grades wrong is worse than no judge — you chase
    // phantom bugs. Use the same model as the app, not a cheaper one.
    model: CHAT_MODEL,
    max_tokens: 1024,
    system: `You grade an AI assistant's answer against a checklist.

Mark each criterion met or not met, exactly as written. Do NOT add requirements
of your own — if a criterion asks for a citation and the answer contains one,
it is met, regardless of how much context surrounds it. Ignore style, length,
and tone. pass = true only if every criterion is met.`,
    messages: [
      {
        role: "user",
        content: `QUESTION:\n${query}\n\nANSWER:\n${answer}\n\nCRITERIA:\n${criteria
          .map((c, i) => `${i + 1}. ${c}`)
          .join("\n")}`,
      },
    ],
    output_config: { format: zodOutputFormat(VerdictSchema) },
  });
  return VerdictSchema.parse(message.parsed_output);
}

const CASES: { name: string; query: string; criteria: string[] }[] = [
  {
    name: "known phrase → cites a real example",
    query: `How is the phrase "${KNOWN_PHRASE}" used? Give me an example.`,
    criteria: [
      "Cites at least one specific example of the phrase in use.",
      "Includes a YouTube link or video title as the source of the example.",
      "Does not refuse or say it lacks the information.",
    ],
  },
  {
    name: "conversational question does not trigger RAG",
    query: "What's a good study routine for learning a new language?",
    criteria: [
      "Answers the question directly and conversationally.",
      "Does not cite a specific ingested video, YouTube link, or transcript excerpt.",
      "Does not claim to have searched a database.",
    ],
  },
  {
    name: "insights request synthesizes multiple examples",
    query: `Explore how the phrase "${KNOWN_PHRASE}" is used based on the available data — are there any patterns?`,
    criteria: [
      "References more than one distinct example or usage pattern, not just a single quoted line.",
      "Does not refuse or say it lacks the information.",
    ],
  },
  {
    name: "never-ingested phrase → admits it has no examples",
    query: `Show me an example of the phrase "${NEVER_INGESTED_PHRASE}" being used.`,
    criteria: [
      "States plainly that no matching examples were found, rather than inventing one.",
      "Does not cite a YouTube link or video title as if it were a real example.",
    ],
  },
];

describe("chat route (end-to-end)", () => {
  it.each(CASES)(
    "$name",
    async ({ query, criteria }) => {
      const { text } = await askChat(query);
      const verdict = await judge(query, text, criteria);

      console.log(`\nQ: ${query}\nA: ${text}\nJUDGE: ${JSON.stringify(verdict)}`);

      expect(verdict.pass).toBe(true);
    },
    60000,
  );
});

describe("anki csv export (end-to-end, structural — not judged)", () => {
  it(
    "generates a parseable, correctly-escaped CSV via the anki_csv SSE event",
    async () => {
      const { ankiCsv } = await askChat(
        `Make me 2 Anki cards for the phrase "${KNOWN_PHRASE}" — front in Spanish, back in English.`,
      );

      expect(ankiCsv).not.toBeNull();
      expect(ankiCsv!.cardCount).toBeGreaterThan(0);

      const lines = ankiCsv!.csv.split("\r\n");
      expect(lines[0]).toBe("Front,Back,Notes");
      expect(lines.length - 1).toBe(ankiCsv!.cardCount);
    },
    60000,
  );
});
