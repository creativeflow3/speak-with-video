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

Create a `.env` file in the project root with the following keys:

```bash
PINECONE_API_KEY=
PINECONE_INDEX=
VOYAGE_API_KEY=
TRANSCRIPTAPI_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=
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

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Lint the codebase |
| `npm run test` | Run the test suite |
| `npm run test:evals` | Run evaluation tests |
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run setup:pinecone` | Create/configure the Pinecone index |

## License

[MIT](LICENSE)
