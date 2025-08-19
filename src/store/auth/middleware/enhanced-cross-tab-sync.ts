/* eslint-disable @typescript-eslint/no-explicit-any */
// Enhanced BroadcastChannel-based cross-tab sync middleware for Zustand
// - Includes state versioning to prevent stale updates
// - Better throttling and conflict resolution
// - Smart filtering to only sync meaningful changes

export type EnhancedCrossTabSyncOptions<TState> = {
  channelName?: string;
  whitelistKeys?: Array<keyof TState>;
  throttleMs?: number;
  enableVersioning?: boolean;
};

export function withEnhancedCrossTabSync<TState extends Record<string, any>>(
  config: (set: any, get: any, api: any) => TState,
  options: EnhancedCrossTabSyncOptions<TState> = {}
) {
  const channelName = options.channelName ?? 'enhanced-auth-store-sync';
  const whitelist = options.whitelistKeys ?? ([] as Array<keyof TState>);
  const throttleMs = options.throttleMs ?? 500;
  const enableVersioning = options.enableVersioning ?? true;
  const ORIGIN = `tab-${Math.random().toString(36).slice(2)}`;

  // Throttling and deduplication state
  let syncTimeout: NodeJS.Timeout | null = null;
  let lastSyncState: string | null = null;
  let lastReceivedVersion: number = 0;

  return (set: any, get: any, api: any) => {
    const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel(channelName)
      : null;

    const wrappedSet = (partial: any, replace?: boolean) => {
      set(partial, replace);
      
      // Check if cross-tab sync is disabled for debugging
      if (typeof window !== 'undefined' && (window as any).__DISABLE_CROSS_TAB_SYNC__) {
        console.log('[EnhancedCrossTabSync] Sync disabled for debugging');
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
            console.log('[EnhancedCrossTabSync] Skipping sync - incomplete state');
            return;
          }
          
          // Build payload
          const payload: Record<string, any> = {};
          const keysToSend = whitelist.length > 0 ? whitelist : (Object.keys(nextState) as Array<keyof TState>);
          for (const key of keysToSend) {
            payload[key as string] = (nextState as any)[key];
          }
          
          // Include version info if versioning is enabled
          if (enableVersioning && nextState.stateVersion !== undefined) {
            payload.stateVersion = nextState.stateVersion;
            payload.lastUpdated = nextState.lastUpdated;
          }
          
          // Prevent duplicate syncs of identical state
          const stateSignature = JSON.stringify({
            sessionId: payload.session?.access_token?.slice(-8),
            profileId: payload.profile?.id,
            version: payload.stateVersion,
            error: payload.error
          });
          
          if (stateSignature === lastSyncState) {
            console.log('[EnhancedCrossTabSync] Skipping sync - identical state signature');
            return;
          }
          lastSyncState = stateSignature;
          
          console.log(`[EnhancedCrossTabSync] Broadcasting state update v${payload.stateVersion || 'unversioned'}`);
          channel.postMessage({ 
            origin: ORIGIN, 
            payload,
            timestamp: Date.now(),
            version: payload.stateVersion || 0
          });
        }, throttleMs);
      } catch (error) {
        console.warn('[EnhancedCrossTabSync] Sync error:', error);
      }
    };

    if (channel) {
      channel.onmessage = (event) => {
        try {
          const { origin, payload, timestamp, version } = (event?.data ?? {}) as { 
            origin?: string; 
            payload?: Record<string, any>;
            timestamp?: number;
            version?: number;
          };
          
          if (!payload || origin === ORIGIN) return;

          // Enhanced filtering for valid payloads
          const hasSession = payload.session;
          const hasProfile = payload.profile;
          const isCompleteState = hasSession && hasProfile;
          
          // Only accept complete, valid states
          if (!isCompleteState) {
            console.log('[EnhancedCrossTabSync] Ignoring incomplete incoming state');
            return;
          }
          
          // Version conflict resolution
          if (enableVersioning && version !== undefined) {
            const currentState = get();
            const currentVersion = currentState.stateVersion || 0;
            const incomingVersion = version || 0;
            
            // Ignore stale updates
            if (incomingVersion <= currentVersion) {
              console.log(`[EnhancedCrossTabSync] Ignoring stale update v${incomingVersion} (current: v${currentVersion})`);
              return;
            }
            
            // Check if we've already processed this version from another tab
            if (incomingVersion <= lastReceivedVersion) {
              console.log(`[EnhancedCrossTabSync] Ignoring duplicate version v${incomingVersion}`);
              return;
            }
            
            lastReceivedVersion = incomingVersion;
          }
          
          // Ignore empty or null-only payloads
          const hasValidData = Object.values(payload).some(value => 
            value !== null && value !== undefined && value !== ''
          );
          if (!hasValidData) {
            console.log('[EnhancedCrossTabSync] Ignoring empty payload');
            return;
          }

          // Apply state with conflict resolution
          const currentState = get();
          const mergedState = { ...currentState, ...payload };
          
          // If both states have the same session but different profiles, use the newer one
          if (currentState.session?.access_token === payload.session?.access_token &&
              currentState.profile?.id !== payload.profile?.id &&
              payload.lastUpdated > currentState.lastUpdated) {
            console.log('[EnhancedCrossTabSync] Resolving profile conflict - using newer profile');
          }

          console.log(`[EnhancedCrossTabSync] Applying state from another tab v${version || 'unversioned'}`);
          set((state: TState) => mergedState);
          
        } catch (error) {
          console.warn('[EnhancedCrossTabSync] Error processing incoming message:', error);
        }
      };
      
      // Handle channel errors
      channel.addEventListener('messageerror', (event) => {
        console.warn('[EnhancedCrossTabSync] Message error:', event);
      });
    }

    const initialState = config(wrappedSet, get, api);
    return initialState;
  };
}
