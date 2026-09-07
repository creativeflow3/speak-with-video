---
name: lib-module
description: Use when adding a new capability to src/lib (a new lib folder), adding files to an existing lib folder, or reviewing/refactoring lib code for structural consistency. Defines the one-capability-per-folder layout, folder/file naming, barrel index.ts exports, and single-responsibility functions used across src/lib.
---

# Lib Module Structure

`src/lib` holds one folder per piece of core functionality. The clean reference
examples already in the repo are `lib/rate-limit`, `lib/tool-dispatcher`,
`lib/video-ingest`, `lib/voyage`, `lib/youtube`, `lib/authz`, `lib/anthropic`,
`lib/logger`, and `lib/languages` — model new modules on these, not on the
legacy exceptions called out at the bottom.

## The standard shape

```
lib/feature-name/
  featureName.ts       # implementation
  featureName.test.ts  # tests, co-located, same base name
  index.ts             # barrel: export * from "./featureName";
```

1. **Folder name** — kebab-case, one folder = one capability (`rate-limit`,
   `tool-dispatcher`, `video-ingest`). If you're tempted to put two unrelated
   capabilities in one folder, split it into two folders instead.
2. **File name** — camelCase version of the folder name (`rate-limit` →
   `rateLimit.ts`, `tool-dispatcher` → `toolDispatcher.ts`). The test file is
   the same base name with `.test.ts`.
3. **Barrel export** — every module gets an `index.ts` that re-exports the
   implementation: `export * from "./featureName";`. Other code imports from
   `@/lib/feature-name`, never by reaching into `@/lib/feature-name/featureName`
   directly.
4. **Single responsibility inside the file** — each exported function does one
   job. Keep private helpers unexported (see `extractEmbeddings` in
   `lib/voyage/voyage.ts` backing `embedDocuments`/`embedQuery`, or
   `findActiveListId`/`createActiveList` backing `addListItem` in
   `lib/anki-list/items.ts`). If a function is doing two things, split it and
   compose.

## When a capability genuinely needs multiple files

Some capabilities have more than one internal concern (e.g. types, plus two or
three distinct pieces of logic). That's fine — give each concern its own
file named for what it does (not a repeat of the folder name), keep each
file's own `.test.ts` next to it, and still export everything through one
`index.ts` so consumers only ever import the folder, e.g.:

```ts
// lib/feature-name/index.ts
export * from "./thing";
export * from "./otherThing";
export type * from "./types";
```

Do not let consumers import deep paths like `@/lib/feature-name/thing` — that
defeats the barrel and is the mistake the legacy folders below made.

## Building a new lib module — checklist

- [ ] One new kebab-case folder under `src/lib`, named for the capability.
- [ ] Implementation file(s) named for what they contain, camelCase.
- [ ] A `.test.ts` next to every implementation file.
- [ ] `index.ts` barrel exporting everything consumers need.
- [ ] Every exported function has one job; multi-step logic is composed from
      small private helpers, not one long function.
- [ ] Nothing outside the folder imports from anything other than the barrel
      (`@/lib/feature-name`).

## Legacy exceptions — don't copy these

A few older folders predate this convention and are missing a barrel, so
consumers reach into their files directly: `lib/tools`, `lib/transcript`,
`lib/anki`, `lib/anki-list`, `lib/evals`. `lib/tools` is also a deliberate
grab-bag of independent tool implementations rather than one capability, so it
won't fully fit this shape even if barreled. Don't force a migration of these
uninvited — but any new file added to one of them, or any new lib folder,
should follow the standard shape above.
