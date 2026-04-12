import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { artifactPath, codesightArtifactsRoot, isInsideRoot, projectRoot, quoteShellArg, renderCodesightCommand, resolveProjectPath } from '../src/codesight.ts';

 test('codesight path helpers', () => {
  assert.equal(codesightArtifactsRoot(), '.codesight');
  assert.equal(projectRoot('.'), process.cwd());
  assert.equal(artifactPath('/repo', 'wiki', 'index.md'), join('/repo', '.codesight', 'wiki', 'index.md'));
  assert.equal(quoteShellArg('simple_path-1.2'), 'simple_path-1.2');
  assert.equal(quoteShellArg('has space'), "'has space'");
  assert.equal(renderCodesightCommand(['--blast', 'src/db.ts']), "npx codesight --blast src/db.ts");
  assert.equal(isInsideRoot('/repo', '/repo/src/app.ts'), true);
  assert.equal(isInsideRoot('/repo', '/tmp/elsewhere.ts'), false);
  assert.equal(resolveProjectPath('/repo', 'src/app.ts'), join('/repo', 'src/app.ts'));
  assert.equal(resolveProjectPath('/repo', '../escape.ts'), null);
});
