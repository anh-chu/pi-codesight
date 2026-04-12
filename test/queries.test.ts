import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { makeTempProject } from './helpers.ts';
import { readEnv, readHotFiles, readRoutes, readSchema, readSummary, readWikiArticle, readWikiIndex } from '../src/queries.ts';

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
});
