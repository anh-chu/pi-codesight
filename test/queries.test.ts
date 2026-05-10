import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTempProject } from './helpers.ts';
import { readChangeImpact, readEnv, readHotFiles, readImportGraph, readRoutes, readSchema, readSummary, readSymbolIndex, readWikiArticle, readWikiIndex } from '../src/queries.ts';

test('queries read generated artifacts', () => {
  const root = makeTempProject({
    '.codesight/wiki/index.md': '# Wiki\n\n- [Overview](./overview.md)\n',
    '.codesight/wiki/overview.md': '# Overview\n\n## High-Impact Files\n\n- `src/a.ts` — imported by **12** files\n- `src/b.ts` — imported by **8** files\n\n## Required Environment Variables\n\n- `DATABASE_URL` — required\n- `PORT` (has default)\n',
    '.codesight/wiki/auth.md': '# Auth\n\n- auth flow\n',
    '.codesight/routes.md': '# Routes\n\n- `GET` `/api/users` [auth, db] ✓\n- `POST` `/api/users` [auth, db]\n## GraphQL\n\n- `name`\n\n## WebSocket Events\n\n- `WS` `eventName` — `src/detectors/graphql.ts`\n',
    '.codesight/CODESIGHT.md': '# CODESIGHT\n\n## Models\n\n- `User` model\n- `Order` model\n',
    '.codesight/config.md': '# Config\n\n## Environment Variables\n\n- `DATABASE_URL` **required** — source\n- `PORT` (has default) — source\n',
  });

  assert.match(readWikiIndex(root).content, /Wiki/);
  assert.match(readWikiArticle(root, 'auth').content, /auth flow/);
  assert.match(readSummary(root).content, /Overview/);
  assert.match(readRoutes(root, { prefix: '/api/users', method: 'GET' }).content, /GET/);
  assert.doesNotMatch(readRoutes(root).content, /GraphQL|WS/);
  assert.match(readSchema(root, 'User').content, /User/);
  assert.match(readEnv(root, true).content, /DATABASE_URL/);
  assert.match(readEnv(root, false).content, /PORT/);
  assert.match(readHotFiles(root, 1).content, /src\/a\.ts/);
});

test('queries return missing artifact hints', () => {
  const root = makeTempProject({});
  assert.match(readWikiIndex(root).content, /Missing codesight wiki index/);
  assert.match(readWikiArticle(root, 'auth').content, /Missing codesight wiki article/);
  assert.match(readSummary(root).content, /Missing codesight artifacts/);
  assert.match(readRoutes(root).content, /Missing codesight routes/);
  assert.match(readSchema(root).content, /Missing codesight schema/);
  assert.match(readEnv(root).content, /Missing codesight env/);
  assert.match(readHotFiles(root).content, /Missing codesight hot files/);
  assert.match(readImportGraph(root).content, /Missing codesight import graph/);
});

test('import graph parses dependency map', () => {
  const root = makeTempProject({
    '.codesight/graph.md': '# Dependency Graph\n\n## Import Map (who imports what)\n\n- `src/a.ts` ← `src/b.ts`, `src/c.ts`\n- `src/b.ts` ← `src/d.ts`\n',
  });

  const result = readImportGraph(root, 'src/a.ts', 2);
  assert.match(result.content, /src\/a\.ts/);
  assert.deepEqual(result.details.directDependents, ['src/b.ts', 'src/c.ts']);
  assert.deepEqual(result.details.directDeps, []);
  assert.deepEqual(result.details.transitiveDependents, ['src/d.ts']);
});

test('import graph returns repo summary when no file given', () => {
  const root = makeTempProject({
    '.codesight/graph.md': '# Dependency Graph\n\n## Import Map (who imports what)\n\n- `src/a.ts` ← `src/b.ts`, `src/c.ts`, `src/d.ts`\n- `src/b.ts` ← `src/c.ts`\n',
  });

  const result = readImportGraph(root);
  assert.match(result.content, /files in graph: 4/);
  assert.ok(Array.isArray(result.details.hubFiles));
  assert.ok(result.details.hubFiles.includes('src/a.ts'));
});

test('symbol index parses libraries and filters by query', () => {
  const root = makeTempProject({
    '.codesight/libs.md': '# Libraries\n\n- `src/auth.ts`\n  - function validateUser: (user) => void\n  - interface Session: {}\n- `src/db.ts`\n  - function connect: () => void\n',
  });

  const all = readSymbolIndex(root);
  assert.equal(all.details.count, 3);
  assert.match(all.content, /validateUser/);

  const filtered = readSymbolIndex(root, 'validate');
  assert.equal(filtered.details.count, 1);
  assert.equal((filtered.details.matches as any[])[0].symbol, 'validateUser');

  const byKind = readSymbolIndex(root, undefined, 'interface');
  assert.equal(byKind.details.count, 1);
  assert.equal((byKind.details.matches as any[])[0].kind, 'interface');
});

test('change impact combines graph, coverage, and routes', () => {
  const root = makeTempProject({
    '.codesight/graph.md': '# Dependency Graph\n\n## Import Map (who imports what)\n\n- `src/auth.ts` ← `src/api.ts`, `src/app.ts`\n',
    '.codesight/coverage.md': '# Test Coverage\n\n> **45%** of routes and models are covered by tests\n> 3 test files found\n',
    '.codesight/routes.md': '# Routes\n\n- `POST` `/api/login` [auth]\n',
    '.codesight/CODESIGHT.md': '# CODESIGHT\n\n## Models\n\n- `User` model in `src/auth.ts`\n',
  });

  const result = readChangeImpact(root, 'src/auth.ts');
  assert.equal(result.details.riskLevel, 'medium');
  assert.deepEqual(result.details.directlyAffected, ['src/api.ts', 'src/app.ts']);
  assert.equal(result.details.testCoverage, 'partial');
  assert.ok(result.details.routes.length > 0);
  assert.ok(result.details.models.includes('User'));
});
