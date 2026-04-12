import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ArtifactFileStatus {
  path: string;
  exists: boolean;
  mtimeMs: number;
}

export interface ArtifactStatus {
  files: ArtifactFileStatus[];
  missing: string[];
  stale: boolean;
}

export function getArtifactStatus(root = '.') {
  const wikiIndex = join(root, '.codesight/wiki/index.md');
  const summary = join(root, '.codesight/CODESIGHT.md');
  const agents = join(root, 'AGENTS.md');
  const files = [wikiIndex, summary, agents].map((path) => ({
    path,
    exists: existsSync(path),
    mtimeMs: existsSync(path) ? statSync(path).mtimeMs : 0,
  }));
  const newest = Math.max(...files.map((file) => file.mtimeMs));
  const oldest = Math.min(...files.filter((file) => file.exists).map((file) => file.mtimeMs).concat([newest]));

  return {
    files,
    missing: files.filter((file) => !file.exists).map((file) => file.path),
    stale: files.some((file) => file.exists) && newest - oldest > 1000 * 60 * 60 * 24 * 7,
  } satisfies ArtifactStatus;
}

export function isStalePlaceholder(): boolean {
  return getArtifactStatus().stale;
}

export function formatArtifactStatus(root = '.') {
  const status = getArtifactStatus(root);
  const missing = status.missing.length ? `missing: ${status.missing.join(', ')}` : 'all artifacts present';
  return status.stale ? `${missing}; stale` : missing;
}
