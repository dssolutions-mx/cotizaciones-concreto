/* eslint-disable @typescript-eslint/no-explicit-any */
// Simple BroadcastChannel-based cross-tab sync middleware for Zustand
// - Whitelists specific keys to broadcast
// - Prevents echo loops via an origin token

export type CrossTabSyncOptions<TState> = {
  channelName?: string;
  whitelistKeys?: Array<keyof TState>;
};

export function withCrossTabSync<TState extends Record<string, any>>(
  config: (set: any, get: any, api: any) => TState,
  options: CrossTabSyncOptions<TState> = {}
) {
  const channelName = options.channelName ?? 'auth-store-sync';
  const whitelist = options.whitelistKeys ?? ([] as Array<keyof TState>);
  const ORIGIN = `tab-${Math.random().toString(36).slice(2)}`;

  return (set: any, get: any, api: any) => {
    const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel(channelName)
      : null;

    const wrappedSet = (partial: any, replace?: boolean) => {
      set(partial, replace);
      try {
        if (!channel) return;
        const nextState = get();
        const payload: Record<string, any> = {};
        const keysToSend = whitelist.length > 0 ? whitelist : (Object.keys(nextState) as Array<keyof TState>);
        for (const key of keysToSend) {
          payload[key as string] = (nextState as any)[key];
        }
        channel.postMessage({ origin: ORIGIN, payload });
      } catch {
        // no-op
      }
    };

    if (channel) {
      channel.onmessage = (event) => {
        const { origin, payload } = (event?.data ?? {}) as { origin?: string; payload?: Record<string, any> };
        if (!payload || origin === ORIGIN) return;
        set((state: TState) => ({ ...state, ...payload }));
      };
    }

    const initialState = config(wrappedSet, get, api);
    return initialState;
  };
}


