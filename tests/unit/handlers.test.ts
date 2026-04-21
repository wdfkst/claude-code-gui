import { describe, it, expect } from 'vitest';
import { handlePing } from '@main/ipc/handlers';

describe('handlePing()', () => {
  it('returns pong with the original message', () => {
    const result = handlePing({ message: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pong).toBe('hello');
      expect(typeof result.data.serverTime).toBe('number');
    }
  });

  it('returns an error envelope when message is missing', () => {
    const result = handlePing({} as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});
