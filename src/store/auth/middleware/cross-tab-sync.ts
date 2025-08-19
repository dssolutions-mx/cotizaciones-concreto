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

  // Throttling state
  const SYNC_THROTTLE_MS = 500;
  let syncTimeout: NodeJS.Timeout | null = null;
  let lastSyncState: string | null = null;

  return (set: any, get: any, api: any) => {
    const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel(channelName)
      : null;

    const wrappedSet = (partial: any, replace?: boolean) => {
      set(partial, replace);
      
      // Check if cross-tab sync is disabled for debugging
      if (typeof window !== 'undefined' && (window as any).__DISABLE_CROSS_TAB_SYNC__) {
        console.log('[CrossTabSync] Sync disabled for debugging');
        return;
      }
      
      try {
        if (!channel) return;
        
        // Clear existing timeout to debounce rapid updates
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        
        // Debounce sync broadcasts
        syncTimeout = setTimeout(() => {
          const nextState = get();
          
          // Only sync complete, valid states
          const hasSession = nextState.session;
          const hasProfile = nextState.profile;
          const isValidState = hasSession && hasProfile;
          
          if (!isValidState) {
            console.log('[CrossTabSync] Skipping sync - incomplete state');
            return;
          }
          
          const payload: Record<string, any> = {};
          const keysToSend = whitelist.length > 0 ? whitelist : (Object.keys(nextState) as Array<keyof TState>);
          for (const key of keysToSend) {
            payload[key as string] = (nextState as any)[key];
          }
          
          // Prevent duplicate syncs of identical state
          const stateSignature = JSON.stringify(payload);
          if (stateSignature === lastSyncState) {
            console.log('[CrossTabSync] Skipping sync - identical state');
            return;
          }
          lastSyncState = stateSignature;
          
          console.log('[CrossTabSync] Broadcasting state update');
          channel.postMessage({ origin: ORIGIN, payload });
        }, SYNC_THROTTLE_MS);
      } catch {
        // no-op
      }
    };

    if (channel) {
      channel.onmessage = (event) => {
        const { origin, payload } = (event?.data ?? {}) as { origin?: string; payload?: Record<string, any> };
        if (!payload || origin === ORIGIN) return;

        // Enhanced filtering for valid payloads
        const hasSession = payload.session;
        const hasProfile = payload.profile;
        const isCompleteState = hasSession && hasProfile;
        
        // Only accept complete, valid states
        if (!isCompleteState) {
          console.log('[CrossTabSync] Ignoring incomplete incoming state');
          return;
        }
        
        // Ignore empty or null-only payloads
        const hasValidData = Object.values(payload).some(value => value !== null && value !== undefined);
        if (!hasValidData) {
          console.log('[CrossTabSync] Ignoring empty payload');
          return;
        }

        console.log('[CrossTabSync] Applying state from another tab');
        set((state: TState) => ({ ...state, ...payload }));
      };
    }

    const initialState = config(wrappedSet, get, api);
    return initialState;
  };
}


