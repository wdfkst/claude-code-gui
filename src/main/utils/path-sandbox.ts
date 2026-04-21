import path from 'node:path';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Resolve `userPath` against `projectRoot` and guarantee it doesn't escape.
 * Returns the absolute, normalized path.
 *
 * @throws SecurityError if userPath escapes projectRoot
 */
export function sandbox(projectRoot: string, userPath: string): string {
  const normalizedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(normalizedRoot, userPath);
  const rel = path.relative(normalizedRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new SecurityError(
      `Path escapes project root: userPath=${userPath} root=${normalizedRoot}`,
    );
  }
  return resolved;
}
