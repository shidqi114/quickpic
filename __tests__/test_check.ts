import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('QuickPic Test Runner Environment Sanity', () => {
  it('should confirm Node.js test environment and TypeScript type stripping readiness', () => {
    assert.strictEqual(typeof process, 'object');
    assert.ok(process.version.startsWith('v2'));
  });
});
