'use client';

import type { StateCreator } from 'zustand';
import type { AuthStoreState, OfflineSliceState } from '../types';

export const createOfflineSlice: StateCreator<AuthStoreState, [['zustand/devtools', never]], [], OfflineSliceState> = (set, get) => ({
  isOnline: true,
  queue: [],
  failedOperations: [],

  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online }, false, 'offline/setOnlineStatus');
    if (online) void get().processQueue();
  },

  processQueue: async () => {
    const tasks = [...get().queue];
    set({ queue: [] }, false, 'offline/clearQueue');
    for (const task of tasks) {
      try {
        await task();
      } catch (e: any) {
        set({ failedOperations: [...get().failedOperations, { at: Date.now(), message: e?.message ?? 'Task failed' }] }, false, 'offline/taskFailed');
      }
    }
  },
});


