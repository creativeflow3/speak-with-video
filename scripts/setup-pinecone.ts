/**
 * Idempotent Pinecone index setup. Run with: npm run setup:pinecone
 */
import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

async function main() {
  const indexName = process.env.PINECONE_INDEX ?? "language-clips";
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
  const pinecone = new Pinecone({ apiKey });

  const existing = await pinecone.listIndexes();
  if (existing.indexes?.some((idx) => idx.name === indexName)) {
    console.log(`Pinecone index "${indexName}" already exists — nothing to do.`);
    return;
  }

  await pinecone.createIndex({
    name: indexName,
    dimension: 1024, // voyage-multilingual-2
    metric: "cosine",
    vectorType: "dense",
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
    waitUntilReady: true,
  });

  console.log(`Created Pinecone index "${indexName}" (dense, dim=1024, metric=cosine, serverless).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
