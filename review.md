# Review

## Summary

Reviewed implemented code in `/home/sil/pi-extensions/pi-codesight`.

Good:
- tests pass
- thin wrapper approach kept
- upstream tool names mostly mirrored
- path escape check exists for blast command
- test injection seams for runner/status are useful

Main issues found below.

## Findings

### 1. `codesight_get_routes` parses non-route bullets
- Severity: high
- File: `src/queries.ts`
- Area: `readRoutes()`

Problem:
- implementation uses all bullet lines from `.codesight/routes.md`
- upstream `routes.md` can contain:
  - HTTP routes
  - GraphQL bullets
  - WebSocket event bullets
- current parser can mix those together

Why this matters:
- tool promises route lookup by prefix/tag/method
- result can include non-route entries

Evidence:
- current code reads `bulletLinesFromSection(lines(content))`
- upstream example `routes.md` includes `## GraphQL` and `## WebSocket Events` sections in same file

Recommendation:
- parse only top-level `# Routes` section
- stop before `## GraphQL` / `## WebSocket Events` or next sibling section
- optionally enforce HTTP-route bullet shape like `` `METHOD` `/path` ``

Test gap:
- current tests only use pure HTTP route bullets, so issue is hidden

---

### 2. `codesight_refresh` semantics drift from upstream
- Severity: medium
- File: `src/tools.ts`
- Area: `codesight_refresh`

Problem:
- tool name mirrors upstream `codesight_refresh`
- but behavior here performs file-generating writes:
  - `npx codesight --wiki`
  - `npx codesight --init`
- upstream MCP `codesight_refresh` is described as force re-scan / refresh cache, not artifact-writing workflow

Why this matters:
- same name, different side effects
- model or user expecting upstream semantics may trigger writes unexpectedly

Recommendation:
- either rename wrapper-specific tool/command
- or align behavior more closely with upstream semantics
- if keeping current behavior, document write side effects very explicitly in tool description and prompt guidance

---

### 3. Env param name not upstream-compatible
- Severity: medium
- File: `src/tools.ts`
- Area: `codesight_get_env`

Problem:
- wrapper uses `requiredOnly`
- upstream codesight MCP uses `required_only`

Why this matters:
- project explicitly chose upstream-aligned naming
- users/docs/models may use upstream parameter name

Recommendation:
- support upstream `required_only`
- optionally keep `requiredOnly` as compatibility alias via argument normalization
- prefer upstream key in public schema/docs

---

### 4. Session-start success notification too noisy
- Severity: low
- File: `src/tools.ts`
- Area: `registerSessionNotice()`

Problem:
- startup hook notifies even when everything is healthy:
  - `CodeSight artifacts look fresh.`

Why this matters:
- adds noise every session
- plan only justified warning on missing/stale artifacts

Recommendation:
- notify only on missing or stale state
- stay silent when artifacts are present and fresh

## Suggested fix order

1. fix route parser
2. resolve refresh semantic mismatch
3. add env param compatibility
4. remove noisy healthy-state notification
