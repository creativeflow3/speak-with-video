import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ankiList, ankiListItems } from "@/db/schema";
import type { AnkiCard } from "@/lib/anki/csv";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

async function findActiveListId(executor: Executor, userId: string): Promise<string | undefined> {
  const [row] = await executor
    .select({ id: ankiList.id })
    .from(ankiList)
    .where(and(eq(ankiList.userId, userId), eq(ankiList.deleted, false)))
    .limit(1);
  return row?.id;
}

async function createActiveList(userId: string): Promise<string> {
  const [created] = await db
    .insert(ankiList)
    .values({ userId })
    .onConflictDoNothing({ target: ankiList.userId, where: sql`deleted = false` })
    .returning({ id: ankiList.id });
  if (created) return created.id;

  // Lost the race to a concurrent insert — the winner's row is now the active list.
  return (await findActiveListId(db, userId))!;
}

export async function addListItem(userId: string, card: AnkiCard): Promise<void> {
  const ankiListId = (await findActiveListId(db, userId)) ?? (await createActiveList(userId));
  await db.insert(ankiListItems).values({
    ankiListId,
    front: card.front,
    back: card.back,
    notes: card.notes ?? null,
  });
}

/** Reads and soft-deletes the user's active list and its items together, resetting their running list. */
export async function downloadAndClearList(userId: string): Promise<AnkiCard[]> {
  return db.transaction(async (tx) => {
    const ankiListId = await findActiveListId(tx, userId);
    if (!ankiListId) return [];

    const [itemRows] = await Promise.all([
      tx
        .update(ankiListItems)
        .set({ deleted: true })
        .where(and(eq(ankiListItems.ankiListId, ankiListId), eq(ankiListItems.deleted, false)))
        .returning({ front: ankiListItems.front, back: ankiListItems.back, notes: ankiListItems.notes }),
      tx.update(ankiList).set({ deleted: true }).where(eq(ankiList.id, ankiListId)),
    ]);

    return itemRows.map((row) => ({ front: row.front, back: row.back, notes: row.notes ?? undefined }));
  });
}
