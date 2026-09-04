# Speak With Video

Paste a YouTube video, then ask how a phrase actually gets used — straight from the transcript. Speak With Video ingests a video's transcript, embeds it, and lets you search real phrase usage in context instead of guessing at a dictionary definition.

<table>
  <tr>
    <td><img width="1207" height="888" alt="Speak With Video desktop view" src="https://github.com/user-attachments/assets/2d2f99eb-51be-446a-8c73-a9fd0a6c11b4" /></td>
    <td><img width="395" height="890" alt="Speak With Video mobile view" src="https://github.com/user-attachments/assets/5848b030-d4d6-45b8-abab-2bcfd8b4ee40" /></td>
  </tr>
</table>

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Pinecone](https://www.pinecone.io) for vector search
- [Voyage AI](https://www.voyageai.com) for embeddings
- [Anthropic](https://www.anthropic.com) for chat/answers
- [TranscriptAPI](https://transcriptapi.com) for YouTube transcripts
- [Auth0](https://auth0.com) for authentication
- [LangSmith](https://smith.langchain.com) for LLM tracing/observability

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/creativeflow3/speak-with-video.git
cd speak-with-video
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `env.example` to `.env` and fill in the values:

```bash
cp env.example .env
```

```bash
PINECONE_API_KEY=
PINECONE_INDEX=
VOYAGE_API_KEY=
TRANSCRIPTAPI_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=              # 64-char random string, e.g. `openssl rand -hex 32`
LANGSMITH_API_KEY=         # optional — enables LLM tracing in LangSmith
LANGSMITH_TRACING=
LANGSMITH_PROJECT=
```

### 4. Set up the database

Run the Drizzle migrations against your PostgreSQL database:

```bash
npm run db:migrate
```

### 5. Set up Pinecone

Create the Pinecone index used for vector search:

```bash
npm run setup:pinecone
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Claude Code Tooling

This repo is set up to work with [Claude Code](https://claude.com/product/claude-code):

- **MCP** — [`.mcp.json`](.mcp.json) configures the [context7](https://context7.com) server, which gives Claude up-to-date library/framework documentation lookups instead of relying on training data. Its API key is read from the `CONTEXT7_API_KEY` environment variable (set in `.claude/settings.local.json`, which is gitignored) rather than being committed.
- **Skills**
  - [`.claude/skills/frontend-design`](.claude/skills/frontend-design/SKILL.md) guides Claude toward distinctive, intentional UI decisions (palette, typography, layout) instead of templated defaults when building or reshaping frontend work in this repo.
  - [`.claude/skills/langsmith-trace`](.claude/skills/langsmith-trace/SKILL.md), [`langsmith-dataset`](.claude/skills/langsmith-dataset/SKILL.md), and [`langsmith-evaluator`](.claude/skills/langsmith-evaluator/SKILL.md) (from [langchain-ai/langsmith-skills](https://github.com/langchain-ai/langsmith-skills)) help Claude add/query LLM tracing, build evaluation datasets from traces, and write custom evaluators against LangSmith.

## Scripts

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `npm run dev`            | Start the development server        |
| `npm run build`          | Build for production                |
| `npm run start`          | Start the production server         |
| `npm run lint`           | Lint the codebase                   |
| `npm run test`           | Run the test suite                  |
| `npm run test:evals`     | Run evaluation tests                |
| `npm run db:generate`    | Generate a new Drizzle migration    |
| `npm run db:migrate`     | Apply Drizzle migrations            |
| `npm run setup:pinecone` | Create/configure the Pinecone index |

## License

[MIT](LICENSE)
