import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@main/utils/logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints INFO messages', () => {
    logger.info('hello');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('[INFO] hello');
  });

  it('redacts api_key from meta', () => {
    logger.info('auth', { api_key: 'secret-123', user: 'alice' });
    const out = logSpy.mock.calls[0][0] as string;
    expect(out).not.toContain('secret-123');
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('alice');
  });

  it('redacts nested sensitive fields', () => {
    logger.info('req', { body: { token: 'abc', data: 'ok' } });
    const out = logSpy.mock.calls[0][0] as string;
    expect(out).not.toContain('abc');
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('ok');
  });
});
