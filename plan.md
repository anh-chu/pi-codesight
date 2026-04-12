# pi-codesight plan

## Goal

Thin Pi extension around codesight.

Add high-value interactive flows beyond generated `AGENTS.md`:
- targeted wiki retrieval
- blast radius queries
- structured routes/schema/env/hot-files lookup
- refresh from Pi
- startup notice when codesight artifacts missing/stale

Do **not** rebuild codesight.
Do **not** build full MCP bridge first.

## Key decision

Mirror codesight MCP tool names as closely as possible.

Reason:
- less cognitive mismatch with upstream docs
- easier for users already familiar with codesight
- easier future swap from shell/file wrapper -> real MCP bridge
- cleaner docs because names match codesight README

## Non-goals

- no custom TUI first
- no full codesight CLI parity
- no persistent MCP client in v1
- no live file watcher in v1
- no custom parsing in extension
- no duplicate repo index implementation

## Architecture choice

### v1

Pi extension shells out to `npx codesight ...` when needed, and reads generated `.codesight/*` files when cheaper.

Reason:
- smallest surface
- least duplicate logic
- keeps codesight source of truth
- easier debug than MCP bridge

### v2 optional

Add MCP bridge only if v1 shows pain:
- repeated cold start cost
- need more codesight tools than wrapper approach supports cleanly
- need persistent session cache from codesight server

## Extension shape

Project-local Pi extension package.

Suggested files:

```text
pi-codesight/
  plan.md
  package.json
  README.md
  src/
    index.ts           # extension entry
    tools.ts           # Pi tool registrations
    commands.ts        # slash commands
    codesight.ts       # shell wrapper + path helpers
    queries.ts         # reads/parses generated .codesight files
    stale.ts           # freshness checks
    format.ts          # compact output formatting
```

## Tool strategy

## v1 tools — include

These give best value/cost ratio and cover main codesight workflows.

1. `codesight_get_wiki_index`
2. `codesight_get_wiki_article`
3. `codesight_get_summary`
4. `codesight_get_routes`
5. `codesight_get_schema`
6. `codesight_get_blast_radius`
7. `codesight_get_env`
8. `codesight_get_hot_files`
9. `codesight_refresh`

## v2 tools — delay

These useful, but lower leverage for first release or need more implementation detail.

10. `codesight_lint_wiki`
11. `codesight_get_events`
12. `codesight_get_coverage`
13. `codesight_get_knowledge`

## Why include or delay each tool

### `codesight_get_wiki_index` — include
- cheapest entry point
- perfect session-start orientation
- direct read from `.codesight/wiki/index.md`

### `codesight_get_wiki_article` — include
- highest-value targeted retrieval
- core use case beyond static `AGENTS.md`
- direct article read is simple and cheap

### `codesight_get_summary` — include
- answers "what is this repo?" fast
- useful fallback when wiki missing
- can derive from `.codesight/wiki/overview.md` or `.codesight/CODESIGHT.md`

### `codesight_get_routes` — include
- common API/backend query
- strong semantic slice
- better than broad summary for endpoint work

### `codesight_get_schema` — include
- common DB/backend query
- high value for migrations, API work, debugging

### `codesight_get_blast_radius` — include
- key differentiator
- strong interactive value beyond AGENTS/wiki
- worth shelling out for

### `codesight_get_env` — include
- practical setup/debugging value
- low complexity if read from generated artifacts

### `codesight_get_hot_files` — include
- cheap orientation/risk tool
- useful before edits and reviews

### `codesight_refresh` — include
- needed glue tool
- wrapper brittle without refresh path

### `codesight_lint_wiki` — delay
- maintenance tool, not core day-1 coding flow
- add after wiki reads stable

### `codesight_get_events` — delay
- valuable only on event-heavy apps
- narrower than routes/schema/blast

### `codesight_get_coverage` — delay
- useful, but secondary to understanding repo structure
- depends on consistent generated coverage artifact

### `codesight_get_knowledge` — delay
- depends on knowledge-mode workflow
- separate from core repo-understanding MVP

## Intended Pi tools

These are LLM-callable via `pi.registerTool()`.

Use upstream-like names exactly.

---

### 1) `codesight_get_wiki_index`

Purpose:
- get wiki catalog for session start / orientation

Schema:

```ts
Type.Object({})
```

Behavior:
- read `.codesight/wiki/index.md`
- if missing, optionally suggest `codesight_refresh`

Return shape:
- content: wiki index markdown
- details:
  - `path`
  - `exists`

Prompt metadata:
- `promptSnippet`: "Read codesight wiki catalog for fast repo orientation"
- `promptGuidelines`:
  - "Use this tool at session start or before broad repo questions."
  - "Prefer this before opening many source files when codesight wiki exists."

---

### 2) `codesight_get_wiki_article`

Purpose:
- read one targeted wiki article like `auth`, `database`, `payments`, `overview`

Schema:

```ts
Type.Object({
  article: Type.String({
    description: "Wiki article name like auth, database, payments, overview"
  })
})
```

Behavior:
- read `.codesight/wiki/${article}.md`
- if missing, return clear message suggesting refresh

Return shape:
- content: article markdown
- details:
  - `article`
  - `path`
  - `exists`

Prompt metadata:
- `promptSnippet`: "Read one codesight wiki article by subsystem name"
- `promptGuidelines`:
  - "Use this tool for subsystem questions like auth, database, payments, or architecture."
  - "Prefer targeted wiki reads over broad repo exploration when article likely exists."

---

### 3) `codesight_get_summary`

Purpose:
- get compact overview of project

Schema:

```ts
Type.Object({})
```

Behavior:
- prefer `.codesight/wiki/overview.md` if present
- else derive compact summary from `.codesight/CODESIGHT.md`
- else explain that codesight artifacts missing

Return shape:
- content: compact overview text
- details:
  - `source`
  - `path`

Prompt metadata:
- `promptSnippet`: "Get compact codesight project overview"
- `promptGuidelines`:
  - "Use this tool for broad orientation before implementation work."

---

### 4) `codesight_get_routes`

Purpose:
- return routes, optionally filtered by prefix, tag, or method

Schema:

```ts
Type.Object({
  prefix: Type.Optional(Type.String({
    description: "Filter routes by path prefix like /api/users"
  })),
  tag: Type.Optional(Type.String({
    description: "Filter routes by tag or subsystem label if available"
  })),
  method: Type.Optional(Type.String({
    description: "Filter by HTTP method like GET, POST, PUT, DELETE"
  }))
})
```

Behavior:
- read routes data from generated codesight artifacts
- filter results in extension
- return compact list

Return shape:
- content: filtered route list
- details:
  - `filters`
  - `count`

Prompt metadata:
- `promptSnippet`: "Get codesight routes filtered by prefix, tag, or method"
- `promptGuidelines`:
  - "Use this tool when user asks what endpoints exist."
  - "Use filters before opening route files manually."

---

### 5) `codesight_get_schema`

Purpose:
- return schema/models, optionally filtered by model name

Schema:

```ts
Type.Object({
  model: Type.Optional(Type.String({
    description: "Filter schema by model name like user, order, session"
  }))
})
```

Behavior:
- read schema/model info from generated artifacts
- filter by model if provided

Return shape:
- content: schema summary or filtered model summary
- details:
  - `model`
  - `count`

Prompt metadata:
- `promptSnippet`: "Get codesight schema or one model summary"
- `promptGuidelines`:
  - "Use this tool for model, table, relation, and field questions."

---

### 6) `codesight_get_blast_radius`

Purpose:
- impact analysis before changing one file

Schema:

```ts
Type.Object({
  file: Type.String({
    description: "Project-relative file path to analyze"
  })
})
```

Behavior:
- run `npx codesight --blast <file>`
- return compact result plus raw stdout in details

Return shape:
- content: compact blast-radius summary
- details:
  - `file`
  - `command`
  - `stdout`

Prompt metadata:
- `promptSnippet`: "Analyze blast radius for file changes using codesight graph"
- `promptGuidelines`:
  - "Use this tool when user asks what might break if a file changes."
  - "Use before risky edits to estimate affected files and tests."

---

### 7) `codesight_get_env`

Purpose:
- list environment variables, optionally only required ones

Schema:

```ts
Type.Object({
  requiredOnly: Type.Optional(Type.Boolean({
    description: "If true, only return required environment variables"
  }))
})
```

Behavior:
- read env/config artifact generated by codesight
- filter if `requiredOnly`

Return shape:
- content: env var summary
- details:
  - `requiredOnly`
  - `count`

Prompt metadata:
- `promptSnippet`: "Get environment variables detected by codesight"
- `promptGuidelines`:
  - "Use this tool for setup, config, and missing-env debugging questions."

---

### 8) `codesight_get_hot_files`

Purpose:
- list most imported / highest-impact files

Schema:

```ts
Type.Object({
  limit: Type.Optional(Type.Number({
    description: "Maximum number of files to return",
    minimum: 1,
    maximum: 50
  }))
})
```

Behavior:
- read hot-file/import graph summary from generated artifacts
- default limit: 10

Return shape:
- content: ranked file list
- details:
  - `limit`
  - `count`

Prompt metadata:
- `promptSnippet`: "Get most imported high-impact files from codesight"
- `promptGuidelines`:
  - "Use this tool for orientation and risk estimation before broad refactors."

---

### 9) `codesight_refresh`

Purpose:
- regenerate repo context artifacts on demand

Schema:

```ts
Type.Object({
  wiki: Type.Optional(Type.Boolean({
    description: "Generate wiki articles"
  })),
  init: Type.Optional(Type.Boolean({
    description: "Generate AGENTS.md and related AI context files"
  }))
})
```

Behavior:
- default `wiki: true`
- commands:
  - wiki only -> `npx codesight --wiki`
  - init only -> `npx codesight --init`
  - both -> run both

Return shape:
- content: summary of regenerated artifacts
- details:
  - `executedCommands`
  - `stdout`
  - `stderr`

Prompt metadata:
- `promptSnippet`: "Refresh codesight-generated repo context files"
- `promptGuidelines`:
  - "Use when codesight files are missing or stale."

## Internal helper only — not exposed as public tool in v1

### `status` helper

Purpose:
- check whether `.codesight/wiki/index.md`, `.codesight/CODESIGHT.md`, and `AGENTS.md` exist
- compute simple stale heuristic from mtimes

Reason not public tool:
- not upstream MCP name
- mostly extension internals
- avoid tool clutter in first release

## Intended slash commands

These are user-triggered, not LLM-triggered.

### `/codesight-refresh [wiki|init|all]`

Examples:
- `/codesight-refresh`
- `/codesight-refresh wiki`
- `/codesight-refresh init`
- `/codesight-refresh all`

Behavior:
- dispatch to same refresh runner as tool
- show UI notification with result

### `/blast <file>`

Examples:
- `/blast src/lib/db.ts`

Behavior:
- run blast query
- emit visible result message into session

### `/wiki [article]`

Examples:
- `/wiki`
- `/wiki auth`
- `/wiki database`

Behavior:
- no arg -> wiki index
- arg -> article
- emit visible result message into session

### Optional later commands
- `/routes [prefix]`
- `/schema [model]`

Keep these out of first milestone unless command UX clearly needed.

## How Pi will trigger these

## A) LLM tool trigger path

Pi exposes active custom tools to model through system prompt.

Relevant Pi behavior:
- `pi.registerTool()` makes tool callable by LLM
- `promptSnippet` adds one-line tool hint to default prompt
- `promptGuidelines` adds bullets telling model when to use tool
- tools registered at startup or `session_start` are callable without `/reload`

### Example: wiki article

User asks:
> how does auth work in this repo?

Expected model behavior:
1. model sees `codesight_get_wiki_article`
2. calls with `{ article: "auth" }`
3. extension reads `.codesight/wiki/auth.md`
4. model answers from article, then source files if needed

### Example: repo orientation

User asks:
> give me quick overview first

Expected model behavior:
1. model sees `codesight_get_summary`
2. calls with `{}`
3. extension returns compact overview
4. model continues with targeted follow-up tools if needed

### Example: blast radius

User asks:
> what breaks if I change src/lib/db.ts?

Expected model behavior:
1. model sees `codesight_get_blast_radius`
2. calls with `{ file: "src/lib/db.ts" }`
3. extension runs `npx codesight --blast src/lib/db.ts`
4. model summarizes affected areas/tests

### Example: route query

User asks:
> what routes exist under /api/users?

Expected model behavior:
1. model sees `codesight_get_routes`
2. calls with `{ prefix: "/api/users" }`
3. extension filters routes and returns list
4. model answers without broad repo exploration

### Example: schema query

User asks:
> show user model

Expected model behavior:
1. model sees `codesight_get_schema`
2. calls with `{ model: "user" }`
3. extension returns filtered schema summary
4. model answers from that slice

### Example: refresh

User asks:
> refresh codesight first

Expected model behavior:
1. model sees `codesight_refresh`
2. calls with `{ wiki: true }`
3. extension regenerates wiki
4. model continues with fresh artifacts

## B) User slash command trigger path

Examples:
- user types `/wiki auth`
- user types `/blast src/lib/db.ts`
- user types `/codesight-refresh all`

Pi behavior:
- extension command handler runs directly
- no LLM needed for command execution
- command may emit visible message or UI notification

## C) Session hook trigger path

Use `session_start` hook.

Behavior:
- check whether `.codesight/wiki/index.md` exists
- if missing: notify user that `/codesight-refresh` can generate it
- if stale: warn non-blocking
- do **not** auto-run codesight in v1

Reason:
- avoid unexpected startup cost
- avoid noisy implicit writes

## Data source plan per tool

### Direct file reads / parsed artifact reads
Use generated artifacts when possible:
- `codesight_get_wiki_index`
- `codesight_get_wiki_article`
- `codesight_get_summary`
- `codesight_get_routes`
- `codesight_get_schema`
- `codesight_get_env`
- `codesight_get_hot_files`

### Shell execution
Use codesight CLI directly when needed:
- `codesight_get_blast_radius`
- `codesight_refresh`

## Implementation phases

### Phase 0 — scaffold
- create `package.json`
- create `src/index.ts`
- create tiny test command
- verify Pi loads extension from project path

### Phase 1 — shell wrapper + path helpers
- helper to run `npx codesight`
- cwd = current project root
- robust stdout/stderr capture
- clear errors when codesight missing

### Phase 2 — artifact readers
- implement readers for wiki files and core `.codesight/*.md`
- settle parsing strategy for routes/schema/env/hot-files

### Phase 3 — core orientation tools
- `codesight_get_wiki_index`
- `codesight_get_wiki_article`
- `codesight_get_summary`
- `/wiki`

### Phase 4 — structural query tools
- `codesight_get_routes`
- `codesight_get_schema`
- `codesight_get_env`
- `codesight_get_hot_files`

### Phase 5 — action tools
- `codesight_get_blast_radius`
- `codesight_refresh`
- `/blast`
- `/codesight-refresh`

### Phase 6 — startup polish
- `session_start` artifact notice
- stale heuristic
- output truncation
- path validation

### Phase 7 — docs and tests
- README with examples
- test parsing helpers
- test command/tool happy paths where feasible

## Error handling rules

- if `codesight` command missing: explain exact install/run expectation
- if article missing: suggest `/codesight-refresh wiki`
- if artifact missing: suggest `codesight_refresh`
- if path outside repo: reject
- if blast target missing: return clear file-not-found error
- truncate huge stdout in content, keep raw details if needed

## Open decisions

1. Shell out to `npx codesight` each call, or require local install?
   - recommend `npx` first

2. Read generated article files directly, or call codesight for article fetch each time?
   - recommend direct file read first

3. Parsing source for routes/schema/env/hot-files from markdown artifacts vs shelling out each time?
   - recommend parse generated markdown first if stable; otherwise shell fallback

4. Whether to support global install path vs project-local only?
   - recommend project-local first

## Example registration sketch

```ts
pi.registerTool({
  name: "codesight_get_wiki_article",
  label: "CodeSight Wiki Article",
  description: "Read one CodeSight wiki article by name",
  promptSnippet: "Read one codesight wiki article by subsystem name",
  promptGuidelines: [
    "Use this tool for subsystem questions like auth, database, payments, or architecture.",
    "Prefer targeted wiki reads over broad repo exploration when article likely exists."
  ],
  parameters: Type.Object({
    article: Type.String()
  }),
  async execute(_toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Reading codesight wiki article..." }] });
    return {
      content: [{ type: "text", text: "...markdown article..." }],
      details: { article: params.article }
    };
  }
});
```

## Trigger sketch

```text
User prompt
  -> Pi default system prompt includes active custom tools
  -> LLM selects matching `codesight_*` tool
  -> extension executes shell/file logic
  -> tool result returns compact markdown/text
  -> LLM answers using targeted context
```

## Recommendation

Build v1 with 9 upstream-aligned tools.
Delay 4 lower-priority tools to v2.
Keep extension thin.
No MCP bridge yet.

## Implementation references and context

This section exists so another agent can implement without re-researching.

## Working directories

### Extension project
- `/home/sil/pi-extensions/pi-codesight`

### Upstream codesight repo clone used for inspection
- `/tmp/pi-github-repos/Houseofmvps/codesight`

### Pi source/docs root
- `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent`

## Must-read Pi docs

### 1. Extension API docs
- File: `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- Most relevant sections:
  - `pi.registerTool(definition)` around lines 1017+
  - `promptSnippet` / `promptGuidelines` behavior around lines 1025+
  - extension quick start near top of file
  - extension auto-discovery paths near top of file

### 2. Pi README
- File: `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent/README.md`
- Relevant findings:
  - Pi core itself has **no built-in MCP config/client**
  - MCP support must come from extension/package layer
  - custom commands and extension loading documented here

## Must-read Pi examples

### Tool registration example
- `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/dynamic-tools.ts`
- Why read: shows `pi.registerTool()`, dynamic registration, `promptSnippet`, `promptGuidelines`

### Command + tool state example
- `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/tools.ts`
- Why read: shows command registration, session hooks, active tool handling

### Extension examples catalog
- `/home/sil/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/README.md`
- Why read: quick map of patterns already available in Pi

## Must-read codesight sources

### 1. README
- `/tmp/pi-github-repos/Houseofmvps/codesight/README.md`
- Why read: source of truth for upstream CLI + MCP tool names + intended semantics
- Important sections to inspect:
  - wiki section
  - MCP tools list around README matches tool names in this plan
  - comparison section for design intent

### 2. MCP server implementation
- `/tmp/pi-github-repos/Houseofmvps/codesight/src/mcp-server.ts`
- Why read: exact upstream tool names and parameter semantics
- Important note: file was reported as invalid UTF-8 by Pi `read`, so inspect with shell tools if needed
- Suggested commands:
  - `rg -n "name: \"codesight_" /tmp/pi-github-repos/Houseofmvps/codesight/src/mcp-server.ts`
  - `python - <<'PY'` / custom script to print slices safely if plain read fails

### 3. Generated artifact examples in upstream repo
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/CODESIGHT.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/routes.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/config.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/events.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/coverage.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/wiki/index.md`
- `/tmp/pi-github-repos/Houseofmvps/codesight/.codesight/wiki/overview.md`
- Why read: determine whether wrapper tools can parse artifacts directly instead of shelling out

## Confirmed research findings

### Pi-side findings
- Pi custom tools become LLM-callable through `pi.registerTool()`
- `promptSnippet` adds one-line entry to default Available tools prompt section
- `promptGuidelines` adds tool-specific bullets while tool is active
- Tools registered at startup or `session_start` are callable without `/reload`
- Pi has no built-in MCP configuration path; MCP needs extension/package bridge if wanted

### codesight-side findings
- codesight already has 13 MCP tools upstream
- v1 extension should mirror upstream tool names, even if implementation is file/shell wrapper
- codesight is repo-context compiler, not parser engine; extension should not duplicate parser logic
- direct file reads look viable for wiki/summary/routes/schema/env/hot-files if artifact formats stable
- shell execution definitely needed for blast radius and refresh in v1

## Suggested implementation assumptions

### Assume project-local extension first
- keep everything inside `/home/sil/pi-extensions/pi-codesight`
- first test by loading extension explicitly with `pi -e ./src/index.ts` or equivalent project entry
- later package for auto-discovery if desired

### Assume `npx codesight` availability
- v1 should call `npx codesight ...`
- if command fails, return actionable error explaining install/usage expectation

### Assume no auto-write on startup
- `session_start` may notify about missing/stale artifacts
- do not auto-run refresh in v1

## Recommended shell inspection commands for next agent

Use these if artifact format or upstream tool semantics unclear:

```bash
# list upstream codesight MCP tool registrations
rg -n 'name: "codesight_' /tmp/pi-github-repos/Houseofmvps/codesight/src/mcp-server.ts

# inspect surrounding lines for one tool
python - <<'PY'
from pathlib import Path
p = Path('/tmp/pi-github-repos/Houseofmvps/codesight/src/mcp-server.ts')
text = p.read_text(errors='replace').splitlines()
for i, line in enumerate(text, 1):
    if 'codesight_get_routes' in line or 'codesight_get_schema' in line:
        start = max(1, i-20)
        end = min(len(text), i+40)
        print(f'--- lines {start}-{end} ---')
        for n in range(start, end+1):
            print(f'{n}:{text[n-1]}')
PY

# inspect generated artifact headings
for f in \
  /tmp/pi-github-repos/Houseofmvps/codesight/.codesight/CODESIGHT.md \
  /tmp/pi-github-repos/Houseofmvps/codesight/.codesight/routes.md \
  /tmp/pi-github-repos/Houseofmvps/codesight/.codesight/config.md \
  /tmp/pi-github-repos/Houseofmvps/codesight/.codesight/wiki/index.md; do
  echo "===== $f"
  head -n 80 "$f"
done
```

## Implementation notes for another agent

1. Keep tool names upstream-aligned.
2. Prefer direct artifact reads when semantics obvious and stable.
3. Fall back to shelling out if parsing markdown becomes brittle.
4. Do not invent extra public tools unless clearly necessary.
5. `status` should stay internal helper in v1.
6. Keep plan as source of truth for scope: 9 v1 tools, 4 deferred v2 tools.
7. If upstream MCP parameter names differ, prefer upstream names over convenience names and update this plan accordingly.
8. Before coding, inspect actual artifact formats in upstream repo rather than guessing markdown structure.
