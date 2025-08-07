'use client';

import type { StateCreator } from 'zustand';
import type { AuthStoreState, CacheSliceState } from '../types';

export const createCacheSlice: StateCreator<AuthStoreState, [['zustand/devtools', never]], [], CacheSliceState> = (set) => ({
  cacheHits: 0,
  cacheMisses: 0,
  lastAuthCheck: null,
  authCheckSource: null,
});


