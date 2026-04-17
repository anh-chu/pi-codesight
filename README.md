# pi-codesight

CodeSight repository-context tools for Pi.

`pi-codesight` gives Pi fast repo orientation from generated `.codesight/` artifacts, routes, schema, env config, wiki pages, hot files, and blast radius.

Upstream analyzer: [Houseofmvps/codesight](https://github.com/Houseofmvps/codesight)

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

Pi loads extension via `package.json.pi.extensions`.
If new tools or slash commands do not appear, run `pi update` or reinstall package.

## Why it exists

Big coding tasks start with discovery:
- where routes live
- which models exist
- which subsystem owns file
- what breaks if file changes
- which env vars matter

`pi-codesight` reads prebuilt CodeSight artifacts first, then agent can move to symbol-level tools (`pi_lsp_*`, `lsp_navigation`) after file/symbol grounding.

## Value props

- **Fast repo orientation**, wiki index and subsystem docs.
- **Endpoint discovery**, route filtering by prefix/tag/method.
- **Schema visibility**, model/table/field/relation summaries.
- **Risk estimation**, blast radius and hot-file ranking.
- **Config clarity**, env variable inspection.
- **Explicit refresh/init**, no hidden regeneration.

## Agent tools

All tools return same envelope:

```ts
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: Record<string, unknown>;
}
```

`details` includes tool-specific metadata.

### `codesight_get_wiki_index`
Read wiki catalog for repo orientation.

**Input schema**
```ts
{ directory?: string }
```

**Output details (typical)**
```ts
{ source: 'wiki/index.md'; path: string }
```

### `codesight_get_wiki_article`
Read one subsystem wiki article.

**Input schema**
```ts
{ article: string; directory?: string }
```

**Output details (typical)**
```ts
{ article: string; source: string; path: string }
```

### `codesight_get_summary`
Get compact project overview.

**Input schema**
```ts
{ directory?: string }
```

**Output details (typical)**
```ts
{ source: string; path: string }
```

### `codesight_get_routes`
Get routes, optional filters.

**Input schema**
```ts
{
  directory?: string;
  prefix?: string;
  tag?: string;
  method?: string; // GET|POST|PUT|DELETE etc
}
```

**Output details (typical)**
```ts
{
  source: string;
  path: string;
  filters: { prefix?: string; tag?: string; method?: string };
  count?: number;
}
```

### `codesight_get_schema`
Get full schema summary or one model view.

**Input schema**
```ts
{ directory?: string; model?: string }
```

**Output details (typical)**
```ts
{ source: string; path: string; model?: string }
```

### `codesight_get_blast_radius`
Run blast-radius query before edits.

**Input schema**
```ts
{ directory?: string; file: string; depth?: number } // depth 1..20
```

**Output details (typical)**
```ts
{
  file: string;
  root: string;
  command: string;
  ok: boolean;
  exitCode?: number;
  stderr?: string;
}
```

### `codesight_get_env`
Read detected environment variables.

**Input schema**
```ts
{ directory?: string; requiredOnly?: boolean }
```

**Output details (typical)**
```ts
{ source: string; path: string; requiredOnly: boolean; count?: number }
```

### `codesight_get_hot_files`
Read highest-impact imported files.

**Input schema**
```ts
{ directory?: string; limit?: number } // limit 1..50
```

**Output details (typical)**
```ts
{ source: string; path: string; limit: number; count?: number }
```

### `codesight_refresh`
Re-scan/regenerate CodeSight artifacts.

**Input schema**
```ts
{ directory?: string; wiki?: boolean; init?: boolean }
```

**Output details**
```ts
{ command: string; ok: boolean; exitCode?: number; stderr?: string }
```

## Slash commands

Yes, extension exposes slash commands:

- `/codesight-refresh` - re-scan CodeSight artifacts
- `/codesight-init` - generate wiki and AI context artifacts
- `/wiki [article]` - show wiki index or one article
- `/blast <file>` - run blast-radius for file

After manifest/command changes, run `pi update` or reinstall package.

## Recommended workflow

- broad discovery -> `codesight_get_summary` or `codesight_get_wiki_index`
- subsystem deep-dive -> `codesight_get_wiki_article`
- endpoint question -> `codesight_get_routes`
- model/table question -> `codesight_get_schema`
- risky edit planning -> `codesight_get_blast_radius` + `codesight_get_hot_files`
- env setup/debug -> `codesight_get_env`
- stale/missing artifacts -> `codesight_refresh`

Then move to symbol-level tools once scope grounded.

## Usage examples

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
Give architecture overview, then drill into database subsystem.
```

## Artifacts

`pi-codesight` reads generated files under `.codesight/`, including:
- `.codesight/wiki/index.md`
- `.codesight/wiki/*.md`
- `.codesight/routes.md`
- `.codesight/config.md`
- `.codesight/CODESIGHT.md`

If artifacts missing or stale, run refresh.
For artifact generation behavior/details, see upstream [CodeSight project](https://github.com/Houseofmvps/codesight).

## Development

```bash
npm test
npm run check
```

## License

MIT. See `LICENSE`.
