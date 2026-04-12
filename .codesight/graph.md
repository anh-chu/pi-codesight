# Dependency Graph

## Most Imported Files (change these carefully)

- `src/codesight.ts` — imported by **6** files
- `src/stale.ts` — imported by **3** files
- `src/tools.ts` — imported by **2** files
- `src/format.ts` — imported by **2** files
- `src/commands.ts` — imported by **1** files
- `test/helpers.ts` — imported by **1** files
- `src/queries.ts` — imported by **1** files

## Import Map (who imports what)

- `src/codesight.ts` ← `src/queries.ts`, `src/tools.ts`, `test/codesight-run.test.ts`, `test/codesight.test.ts`, `test/tools.test.ts` +1 more
- `src/stale.ts` ← `src/tools.ts`, `test/stale.test.ts`, `test/tools.test.ts`
- `src/tools.ts` ← `src/commands.ts`, `src/index.ts`
- `src/format.ts` ← `src/queries.ts`, `src/tools.ts`
- `src/commands.ts` ← `src/index.ts`
- `test/helpers.ts` ← `test/queries.test.ts`
- `src/queries.ts` ← `test/queries.test.ts`
