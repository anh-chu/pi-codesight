# pi-codesight

CodeSight repository-context tools for Pi.

`pi-codesight` gives Pi fast repo orientation from generated `.codesight/` artifacts, routes, schema, env config, wiki pages, hot files, and blast radius. Goal: answer broad architecture questions fast, before deeper symbol-level navigation.

## Install

```bash
pi install npm:pi-codesight
```

Or from git:

```bash
pi install git:github.com/anh-chu/pi-codesight
```

Or via npm directly:

```bash
npm install pi-codesight
```

Pi loads extension via `package.json.pi.extensions`. If new slash commands or tools do not show, run `pi update` or reinstall package.

## Why it exists

Big coding tasks start with discovery:
- where routes live
- which models exist
- which subsystem owns file
- what breaks if file changes
- which env vars matter

Reading source tree file-by-file slow. `pi-codesight` uses prebuilt artifacts so Pi can answer these quickly, then hand off to symbol-level tools when needed.

## Value props

- **Fast repo orientation**, wiki index + subsystem article lookup.
- **Endpoint discovery**, route filtering by prefix/tag/method.
- **Data-model visibility**, schema/model summaries from generated context.
- **Risk estimation**, blast radius and hot-file ranking before refactors.
- **Config clarity**, required/optional env var inspection.
- **User-controlled generation**, refresh/init stay explicit, no hidden rewrites.

## Agent tools

All tools register when extension loads.

### `codesight_get_wiki_index`
Read `.codesight/wiki/index.md` catalog. Best first move for “where things live”.

### `codesight_get_wiki_article`
Read one subsystem article by name, for example `overview`, `auth`, `database`, `payments`.

### `codesight_get_summary`
Compact project summary for quick orientation.

### `codesight_get_routes`
Get routes with optional filters:
- `prefix` (example `/api/users`)
- `tag` (subsystem)
- `method` (`GET`, `POST`, `PUT`, `DELETE`)

### `codesight_get_schema`
Get schema overview or single model summary with `model` filter.

### `codesight_get_blast_radius`
Estimate impact before edits:
- required: `file`
- optional: `depth`

### `codesight_get_env`
List detected env vars. Use `requiredOnly: true` for required-only view.

### `codesight_get_hot_files`
Show most imported high-impact files, optional `limit`.

### `codesight_refresh`
Re-scan and refresh CodeSight artifacts.
- `wiki: true` to regenerate wiki artifacts
- `init: true` to regenerate AI context files

## Recommended workflow

Rule of thumb:
- broad discovery question -> `codesight_get_summary` or `codesight_get_wiki_index`
- subsystem deep-dive -> `codesight_get_wiki_article`
- endpoint question -> `codesight_get_routes`
- model/table question -> `codesight_get_schema`
- risky edit planning -> `codesight_get_blast_radius` + `codesight_get_hot_files`
- setup/debug env issue -> `codesight_get_env`
- stale or missing artifacts -> `codesight_refresh`

Then move to symbol-level tools (`lsp_navigation`, `pi_lsp_*`) once file/symbol grounded.

## Usage examples

Natural prompts:

```text
What endpoints exist under /api/admin?
```

```text
If I change src/auth/session.ts, what might break?
```

```text
Show required env vars for this project.
```

```text
Give me architecture overview, then drill into database subsystem.
```

## Artifacts

`pi-codesight` reads generated artifacts from `.codesight/`, including:
- `.codesight/wiki/index.md`
- `.codesight/wiki/*.md`
- `.codesight/routes.md`
- `.codesight/config.md`
- other generated context files

If artifacts missing or stale, run refresh tool.

## Development

```bash
npm test
npm run check
```

## License

MIT. See `LICENSE`.
