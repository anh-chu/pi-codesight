# Project Context

This is a javascript project using raw-http.

## Codebase Navigation — Use CodeSight Tools First

**Do NOT start with grep/find/read for codebase exploration. Call codesight tools instead.**

| Question | Tool to call first |
|---|---|
| Where does X live? What exists? | `codesight_get_wiki_index` |
| What does this subsystem do? | `codesight_get_wiki_article` |
| What are the high-impact files? | `codesight_get_hot_files` |
| What routes exist? | `codesight_get_routes` |
| What models/schema exist? | `codesight_get_schema` |
| What env vars does this need? | `codesight_get_env` |
| What breaks if I change file X? | `codesight_get_blast_radius` |
| Quick architecture summary? | `codesight_get_summary` |

Only read source files after using a codesight tool to identify which files matter.
Grep/find are for targeted symbol lookups after orientation, not initial exploration.

## High-impact files (most imported)

- src/tools.ts (imported by 2 files)
- src/codesight.ts (imported by 2 files)
- src/format.ts (imported by 2 files)
- src/commands.ts (imported by 1 files)
- src/stale.ts (imported by 1 files)
