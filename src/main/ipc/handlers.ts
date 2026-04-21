import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { IpcResult, PingInput, PingOutput } from '@shared/types';

/**
 * Pure handler — can be unit tested without Electron runtime.
 */
export function handlePing(input: PingInput): IpcResult<PingOutput> {
  if (typeof input?.message !== 'string') {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'message must be a string' },
    };
  }
  return {
    ok: true,
    data: { pong: input.message, serverTime: Date.now() },
  };
}

/**
 * Wire pure handlers to ipcMain. Called once from main entry.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.PING, (_evt, input: PingInput) => handlePing(input));
}
