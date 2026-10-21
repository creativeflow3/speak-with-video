/**
 * Applies pending drizzle migrations during a Vercel *production* build, before
 * `next build` — so the schema is updated before the new code goes live, and a
 * failed migration fails the build (the current deployment keeps serving).
 *
 * Runs as part of `npm run build`. Skips everywhere else:
 * - Preview deploys share the production database, so a preview must never migrate it.
 * - Local builds have no VERCEL_ENV and skip too; use `npm run db:migrate` locally.
 *
 * Every migration must be safe for the code that's still live while it runs
 * (e.g. drop a column only after a deploy that stops using it).
 */
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const MIGRATIONS_FOLDER = "./src/db/migrations";

type Env = Record<string, string | undefined>;
export type MigrationPlan = { run: true; url: string } | { run: false; reason: string };

/** Decides whether this build should migrate, and against which connection. */
export function planDeployMigration(env: Env): MigrationPlan {
  if (env.VERCEL_ENV !== "production") {
    return { run: false, reason: `VERCEL_ENV is "${env.VERCEL_ENV ?? "unset"}", not "production"` };
  }
  // DDL goes over the direct connection, not Neon's PgBouncer pooler.
  const url = env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set — refusing to migrate over the pooled connection");
  return { run: true, url };
}

async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}

async function main() {
  const plan = planDeployMigration(process.env);
  if (!plan.run) {
    console.log(`[migrate-on-deploy] Skipping migrations: ${plan.reason}.`);
    return;
  }
  console.log("[migrate-on-deploy] Applying pending migrations to production…");
  await runMigrations(plan.url);
  console.log("[migrate-on-deploy] Migrations up to date.");
}

// Only run when executed directly (not when imported by the test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("[migrate-on-deploy] Migration failed — aborting the build.", err);
    process.exit(1);
  });
}
