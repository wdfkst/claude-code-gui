import type { IpcResult } from '@shared/types';

/**
 * Unwrap IpcResult — throws on error, returns data on success.
 * Use this when a call is expected to succeed and errors are exceptional.
 */
export async function unwrap<T>(call: Promise<IpcResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) {
    throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
  return result.data;
}

/**
 * Safe call — returns a plain object, lets caller decide how to handle errors.
 */
export function safeCall<T>(call: Promise<IpcResult<T>>): Promise<IpcResult<T>> {
  return call.catch((e: Error) => ({
    ok: false as const,
    error: { code: 'IPC_ERROR', message: e.message },
  }));
}
