import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { IpcResult, PingInput, PingOutput } from '@shared/types';

/**
 * Minimal, strongly-typed API exposed to the renderer.
 * Every new IPC call must be added here AND to shared/ipc-channels.ts.
 */
const api = {
  ping(input: PingInput): Promise<IpcResult<PingOutput>> {
    return ipcRenderer.invoke(IpcChannels.PING, input);
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type RendererApi = typeof api;
