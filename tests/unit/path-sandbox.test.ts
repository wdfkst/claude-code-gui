import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { sandbox, SecurityError } from '@main/utils/path-sandbox';

// Use path.resolve to construct cross-platform expected values.
const root = path.resolve('/project');

describe('sandbox()', () => {
  it('accepts a path inside the root', () => {
    expect(sandbox(root, 'src/App.vue')).toBe(path.join(root, 'src/App.vue'));
  });

  it('accepts the root itself via "." ', () => {
    expect(sandbox(root, '.')).toBe(root);
  });

  it('rejects a path with .. that escapes root', () => {
    expect(() => sandbox(root, '../etc/passwd')).toThrow(SecurityError);
  });

  it('rejects a path with deep .. that escapes root', () => {
    expect(() => sandbox(root, 'src/../../etc/passwd')).toThrow(SecurityError);
  });

  it('rejects an absolute path unrelated to root', () => {
    const outside = path.resolve('/etc/passwd');
    expect(() => sandbox(root, outside)).toThrow(SecurityError);
  });

  it('accepts an absolute path inside the root', () => {
    const inside = path.join(root, 'src/App.vue');
    expect(sandbox(root, inside)).toBe(inside);
  });

  it('normalizes repeated slashes', () => {
    expect(sandbox(root, 'src//App.vue')).toBe(path.join(root, 'src/App.vue'));
  });
});
