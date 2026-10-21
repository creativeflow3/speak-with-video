import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ankiList, ankiListItems } from "@/db/schema";
import type { AnkiCard } from "@/lib/anki";
import { isUuid } from "@/lib/utils";
import { getList, resolveListForUser, ListNotFoundError, type AnkiListRef } from "./lists";

export interface AnkiListItem extends AnkiCard {
  id: string;
}

export interface ListExport {
  list: AnkiListRef;
  cards: AnkiCard[];
}

function activeItemsOf(listId: string) {
  return and(eq(ankiListItems.ankiListId, listId), eq(ankiListItems.deleted, false));
}

/** Folds the ownership check into a write: matches the list only if this user owns it and it's active. */
function ownedListId(userId: string, listId: string) {
  return inArray(
    ankiListItems.ankiListId,
    db
      .select({ id: ankiList.id })
      .from(ankiList)
      .where(and(eq(ankiList.id, listId), eq(ankiList.userId, userId), eq(ankiList.deleted, false))),
  );
}

/** Adds a card to the chosen list, falling back to Default; returns the list it landed in. */
export async function addListItem(userId: string, card: AnkiCard, listId?: string): Promise<AnkiListRef> {
  const list = await resolveListForUser(userId, listId);
  await db.insert(ankiListItems).values({
    ankiListId: list.id,
    front: card.front,
    back: card.back,
    notes: card.notes ?? null,
  });
  return list;
}

async function selectItems(listId: string): Promise<AnkiListItem[]> {
  const rows = await db
    .select({ id: ankiListItems.id, front: ankiListItems.front, back: ankiListItems.back, notes: ankiListItems.notes })
    .from(ankiListItems)
    .where(activeItemsOf(listId))
    .orderBy(asc(ankiListItems.createdAt));
  return rows.map((row) => ({ ...row, notes: row.notes ?? undefined }));
}

/** One of the user's lists with its words. Throws ListNotFoundError if they don't own it. */
export async function getListWithItems(
  userId: string,
  listId: string,
): Promise<{ list: AnkiListRef; items: AnkiListItem[] }> {
  if (!isUuid(listId)) throw new ListNotFoundError();
  // In parallel: if the ownership check fails, the items read is discarded unseen.
  const [list, items] = await Promise.all([getList(userId, listId), selectItems(listId)]);
  return { list, items };
}

/** The words in one of the user's lists. Throws ListNotFoundError if they don't own it. */
export async function listItems(userId: string, listId: string): Promise<AnkiListItem[]> {
  return (await getListWithItems(userId, listId)).items;
}

/** Soft-deletes one word, only if it sits in an active list this user owns. Returns whether it was removed. */
export async function deleteListItem(userId: string, listId: string, itemId: string): Promise<boolean> {
  if (!isUuid(listId) || !isUuid(itemId)) return false;
  const removed = await db
    .update(ankiListItems)
    .set({ deleted: true })
    .where(and(eq(ankiListItems.id, itemId), activeItemsOf(listId), ownedListId(userId, listId)))
    .returning({ id: ankiListItems.id });
  return removed.length > 0;
}

/** Soft-deletes every word in one of the user's lists — how the Default list gets emptied. */
export async function clearListItems(userId: string, listId: string): Promise<number> {
  if (!isUuid(listId)) throw new ListNotFoundError();
  const cleared = await db
    .update(ankiListItems)
    .set({ deleted: true })
    .where(and(activeItemsOf(listId), ownedListId(userId, listId)))
    .returning({ id: ankiListItems.id });
  // Nothing cleared is either an empty list or one the user doesn't own — only then is the lookup worth it.
  if (cleared.length === 0) await getList(userId, listId);
  return cleared.length;
}

/** Reads the chosen list (or Default) for export. Unlike the old download, nothing is cleared. */
export async function exportList(userId: string, listId?: string): Promise<ListExport> {
  const list = await resolveListForUser(userId, listId);
  return { list, cards: await selectItems(list.id) };
}
