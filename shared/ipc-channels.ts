/**
 * All IPC channels used in fangkejia-pro.
 * Every IPC call must use a constant from this file.
 */
export const IpcChannels = {
  PING: 'ipc:ping',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
