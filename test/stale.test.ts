import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatArtifactStatus, getArtifactStatus } from '../src/stale.ts';

function setup(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'pi-codesight-stale-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = join(root, relativePath);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

test('artifact status detects missing files', () => {
  const root = setup({});
  const status = getArtifactStatus(root);
  assert.equal(status.missing.length, 3);
  assert.equal(status.stale, false);
  assert.match(formatArtifactStatus(root), /missing:/);
});

test('artifact status detects stale gap', () => {
  const root = setup({
    '.codesight/wiki/index.md': 'x',
    '.codesight/CODESIGHT.md': 'x',
    'AGENTS.md': 'x',
  });
  const now = new Date();
  const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  utimesSync(join(root, '.codesight/wiki/index.md'), old, old);
  utimesSync(join(root, '.codesight/CODESIGHT.md'), now, now);
  utimesSync(join(root, 'AGENTS.md'), now, now);
  assert.equal(getArtifactStatus(root).stale, true);
});
