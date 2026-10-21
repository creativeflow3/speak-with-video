import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ankiList, ankiListItems } from "@/db/schema";
import { validateListName } from "@/lib/list-names";
import { isUuid } from "@/lib/utils";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

const DEFAULT_LIST_NAME = "Default";

const UNIQUE_VIOLATION = "23505";

export class InvalidListNameError extends Error {
  name = "InvalidListNameError";
}

export class DuplicateListNameError extends Error {
  name = "DuplicateListNameError";
  constructor(listName: string) {
    super(`You already have a list named "${listName}"`);
  }
}

/** Thrown for a list that doesn't exist, is deleted, or belongs to someone else — callers map it to 404. */
export class ListNotFoundError extends Error {
  name = "ListNotFoundError";
  constructor() {
    super("List not found");
  }
}

export class DefaultListDeleteError extends Error {
  name = "DefaultListDeleteError";
  constructor() {
    super("The Default list can't be deleted — clear its words instead");
  }
}

export interface AnkiListRef {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AnkiListSummary extends AnkiListRef {
  itemCount: number;
  createdAt: Date;
}

const LIST_REF_COLUMNS = { id: ankiList.id, name: ankiList.ankiListName, isDefault: ankiList.isDefault };

function activeListsOf(userId: string) {
  return and(eq(ankiList.userId, userId), eq(ankiList.deleted, false));
}

/** Malformed ids (from URLs or the chat body) are treated like lists the user doesn't own. */
async function findOwnedList(executor: Executor, userId: string, listId: string): Promise<AnkiListRef | undefined> {
  if (!isUuid(listId)) return undefined;
  const [row] = await executor
    .select(LIST_REF_COLUMNS)
    .from(ankiList)
    .where(and(eq(ankiList.id, listId), activeListsOf(userId)))
    .limit(1);
  return row;
}

async function findDefaultList(userId: string): Promise<AnkiListRef | undefined> {
  const [row] = await db
    .select(LIST_REF_COLUMNS)
    .from(ankiList)
    .where(and(activeListsOf(userId), eq(ankiList.isDefault, true)))
    .limit(1);
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps driver errors in DrizzleQueryError, keeping the postgres error as `cause`.
  const candidates = [err, (err as { cause?: unknown } | null)?.cause];
  return candidates.some((e) => (e as { code?: string } | null)?.code === UNIQUE_VIOLATION);
}

export async function getOrCreateDefaultList(userId: string): Promise<AnkiListRef> {
  const existing = await findDefaultList(userId);
  if (existing) return existing;

  const [created] = await db
    .insert(ankiList)
    .values({ userId, ankiListName: DEFAULT_LIST_NAME, isDefault: true })
    .onConflictDoNothing({ target: ankiList.userId, where: sql`is_default = true AND deleted = false` })
    .returning(LIST_REF_COLUMNS);
  if (created) return created;

  // Lost the race to a concurrent insert — the winner's row is now the default list.
  return (await findDefaultList(userId))!;
}

/** Returns the list if this user owns it and it is active, throwing ListNotFoundError otherwise. */
export async function getList(userId: string, listId: string): Promise<AnkiListRef> {
  const list = await findOwnedList(db, userId, listId);
  if (!list) throw new ListNotFoundError();
  return list;
}

/** The user's chosen list when they own it and it's active; otherwise their Default list. */
export async function resolveListForUser(userId: string, listId?: string): Promise<AnkiListRef> {
  const chosen = listId ? await findOwnedList(db, userId, listId) : undefined;
  return chosen ?? getOrCreateDefaultList(userId);
}

async function selectListSummaries(userId: string): Promise<AnkiListSummary[]> {
  return db
    .select({ ...LIST_REF_COLUMNS, createdAt: ankiList.createdAt, itemCount: sql<number>`count(${ankiListItems.id})::int` })
    .from(ankiList)
    .leftJoin(ankiListItems, and(eq(ankiListItems.ankiListId, ankiList.id), eq(ankiListItems.deleted, false)))
    .where(activeListsOf(userId))
    .groupBy(ankiList.id)
    .orderBy(desc(ankiList.isDefault), asc(ankiList.createdAt));
}

/** The user's active lists with word counts, Default first — creating the Default list on first use. */
export async function listLists(userId: string): Promise<AnkiListSummary[]> {
  const lists = await selectListSummaries(userId);
  if (lists.some((list) => list.isDefault)) return lists;

  await getOrCreateDefaultList(userId);
  return selectListSummaries(userId);
}

/**
 * Just the names of the user's lists, Default first — for the chat picker, which renders on
 * every home page load and doesn't need the per-list word counts.
 */
export async function listListRefs(userId: string): Promise<AnkiListRef[]> {
  const lists = await db
    .select(LIST_REF_COLUMNS)
    .from(ankiList)
    .where(activeListsOf(userId))
    .orderBy(desc(ankiList.isDefault), asc(ankiList.createdAt));
  if (lists.some((list) => list.isDefault)) return lists;

  return [await getOrCreateDefaultList(userId), ...lists];
}

export async function createList(userId: string, rawName: string): Promise<AnkiListRef> {
  const result = validateListName(rawName);
  if ("error" in result) throw new InvalidListNameError(result.error);

  // A user list must never claim the name before the real Default list exists.
  if (result.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase()) await getOrCreateDefaultList(userId);
  try {
    const [created] = await db
      .insert(ankiList)
      .values({ userId, ankiListName: result.name })
      .returning(LIST_REF_COLUMNS);
    return created;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateListNameError(result.name);
    throw err;
  }
}

/** Soft-deletes a non-default list and its words together. */
export async function deleteList(userId: string, listId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const list = await findOwnedList(tx, userId, listId);
    if (!list) throw new ListNotFoundError();
    if (list.isDefault) throw new DefaultListDeleteError();

    await tx
      .update(ankiListItems)
      .set({ deleted: true })
      .where(and(eq(ankiListItems.ankiListId, listId), eq(ankiListItems.deleted, false)));
    await tx.update(ankiList).set({ deleted: true }).where(eq(ankiList.id, listId));
  });
}
