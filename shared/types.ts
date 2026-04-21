/**
 * Standard envelope for every IPC response.
 * Handlers return IpcResult<T>; renderer checks `ok` before using `data`.
 */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface PingInput {
  message: string;
}

export interface PingOutput {
  pong: string;
  serverTime: number;
}
