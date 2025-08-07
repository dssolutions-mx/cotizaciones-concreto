'use client';

import type { StateCreator } from 'zustand';
import type { AuthStoreState, MetricsSliceState } from '../types';

export const createMetricsSlice: StateCreator<AuthStoreState, [['zustand/devtools', never]], [], MetricsSliceState> = (set, get) => ({
  authLatencyMs: [],
  failedOperationsCount: 0,
  getMetricsSummary: () => {
    const samples = get().authLatencyMs;
    const avg = samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : 0;
    return { avgLatencyMs: avg, operationsFailed: get().failedOperationsCount };
  },
});


