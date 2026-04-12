import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCodesightCommand } from '../src/codesight.ts';

test('renderCodesightCommand quotes shell args', () => {
  assert.equal(
    renderCodesightCommand(['--blast', 'src/my file.ts']),
    "npx codesight --blast 'src/my file.ts'",
  );
});
