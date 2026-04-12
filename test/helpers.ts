import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTempProject(structure: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'pi-codesight-'));
  for (const [relativePath, content] of Object.entries(structure)) {
    const absolute = join(root, relativePath);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}
