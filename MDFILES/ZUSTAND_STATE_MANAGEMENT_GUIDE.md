### Zustand in the Maintenance Dashboard: Architecture and Implementation Guidelines

This document explains the Zustand-based state architecture used in this project and provides clear, actionable guidelines to implement a similar approach in other web applications.

---

## Executive summary

- **Store composition**: Modular slice-based design composed into a single `useAuthStore` with `persist` and `devtools` middleware.
- **Persistence**: Strict `partialize` to persist only non-sensitive, essential state; sessions and timers remain in-memory.
- **Stability**: Debounced auth checks, proactive token refresh, TTL caches, bounded arrays, and circuit-breaker-like metrics.
- **Cross-tab sync**: `BroadcastChannel`-based, selective key sync (`user`, `profile`, `session`), with tab registration and loop prevention.
- **Offline-first**: Queue with retry/backoff, dynamic imports to avoid circular deps, online/offline listeners, and mobile session recovery.
- **Integration**: A thin `AuthInitializer` wires `initialize()`, auth events, and network listeners; components consume state via a lightweight hook.

---

## High-level architecture

```mermaid
flowchart LR
  subgraph Store[Zustand Store]
    A[AuthSlice]
    B[SessionSlice]
    C[CacheSlice]
    D[MetricsSlice]
    E[OfflineSlice]
  end

  A -->|sets/reads| Store
  B -->|schedules refresh| Store
  C -->|TTL caches| Store
  D -->|track health| Store
  E -->|queue retries| Store

  subgraph Middleware
    M1[devtools]
    M2[persist(partialize)]
    M3[BroadcastChannel cross-tab]
  end

  Store --> M1
  Store --> M2
  Store --> M3

  UI[Components/hooks] -->|selectors using useShallow| Store
  Init[AuthInitializer] -->|initialize + auth events| Store
```

Key files:
- `store/index.ts`
- `store/slices/{auth,session,cache,metrics,offline}-slice.ts`
- `store/middleware/cross-tab-sync.ts`
- `hooks/use-auth-zustand.ts`
- `hooks/use-mobile-session-recovery.ts`
- `components/auth/auth-initializer.tsx`

---

## Core store composition and persistence

The store composes multiple slices and applies middleware:

```ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createSessionSlice(...args),
        ...createCacheSlice(...args),
        ...createMetricsSlice(...args),
        ...createOfflineSlice(...args),
      }),
      {
        name: 'auth-store',
        version: 1,
        // Only persist non-sensitive state
        partialize: (state: AuthStore) => ({
          user: state.user,
          profile: state.profile,
          lastAuthCheck: state.lastAuthCheck,
          authCheckSource: state.authCheckSource,
          cacheHits: state.cacheHits,
          cacheMisses: state.cacheMisses,
          queue: state.queue,
          failedOperations: state.failedOperations,
          lastSyncTime: state.lastSyncTime,
        }),
      }
    ),
    { name: 'AuthStore', trace: true }
  )
)

// Non-hook access for services/utilities
export const authStore = {
  getState: useAuthStore.getState,
  setState: useAuthStore.setState,
  subscribe: useAuthStore.subscribe,
  destroy: useAuthStore.destroy,
}
```

Guidelines:
- **Do not persist sensitive data**: Avoid persisting `session`, tokens, timers, or internal metrics.
- **Use `partialize` aggressively**: Be explicit about what you persist to minimize hydration issues and lock-in bugs.
- **Name the store in devtools** for easier debugging.
- Provide a small `authStore` facade for non-hook usage in services, workers, and queues.

---

## Slices and responsibilities

### AuthSlice (`store/slices/auth-slice.ts`)
- State: `user`, `session`, `profile`, `isLoading`, `isInitialized`, `error`, `lastAuthCheck`, `authCheckSource`.
- Actions:
  - `initialize()`: Fast paths (persisted and cached session) before slow path (network), each with timeouts; background session hydration; profile fetch with timeout.
  - `signIn()`, `signOut()`: Robust error handling, cache updates, and UI-safe state transitions; on sign-out, clear state first, then sign out remotely, then hard redirect.
  - `refreshSession()`: Updates caches and metrics.
  - `loadProfile()`, `refreshProfile()`: Cached read with TTL, network fallback with timeout.
  - Password ops: `resetPasswordForEmail()`, `updatePassword()` with metrics.
  - Mobile: `recoverMobileSession()` attempts `getUser` → `getSession` (for "Auth session missing") → `refreshSession`.

Design practices:
- Always set `isInitialized` once; avoid init loops.
- Put timeouts around network requests to prevent hangs.
- Cache critical data immediately after successful fetches.

### SessionSlice (`store/slices/session-slice.ts`)
- Schedules proactive token refresh at ~75% of token lifetime.
- Tracks recent session activities (bounded to the last 50) to avoid memory growth.
- Utilities: `isSessionExpiringSoon()`, `getSessionTimeRemaining()`.

Design practices:
- Clear existing timers before scheduling another.
- Keep activity logs bounded to prevent leaks.

### CacheSlice (`store/slices/cache-slice.ts`)
- `Map`-based TTL caches for profiles and sessions.
- Tracks `cacheHits` and `cacheMisses`; supports periodic `pruneExpiredCache()`.

Design practices:
- Log hit/miss to understand effectiveness.
- Keep TTLs conservative; prefer fresh data for auth-critical paths.

### MetricsSlice (`store/slices/metrics-slice.ts`)
- Tracks `authLatency[]` (bounded), weighted `sessionStability`, `offlineOperations`, and `failedOperationsCount`.
- Provides `getMetricsSummary()` with early warnings for degraded stability, high latency, and low cache hit rate.

Design practices:
- Use bounded arrays; avoid unbounded metric growth.
- Warn on thresholds to surface regressions early.

### OfflineSlice (`store/slices/offline-slice.ts`)
- Queue structure with `retryCount` and `maxRetries`.
- `processQueue()` dynamically imports the store to avoid circular dependencies; processes operations by type.
- `setOnlineStatus()` triggers processing when network returns.

Design practices:
- Use dynamic imports in queues/services to avoid cyclic imports.
- Limit retries; move exhausted items to `failedOperations`.

---

## Cross-tab state synchronization

`store/middleware/cross-tab-sync.ts` implements a `BroadcastChannel`-based sync:
- Sync keys: by default `['user', 'profile', 'session']`.
- Tab lifecycle: registration, PING/PONG discovery, and unregistration on unload.
- Loop prevention: `ignoreNextUpdate` and `isInitializing` flags.
- Safety: filter payloads to only whitelisted keys, ignore null-only updates.

Guidelines:
- Use a dedicated channel name per store/domain.
- Keep the sync payload minimal; avoid large objects.
- Guard for `typeof window === 'undefined'` to allow SSR rendering.

---

## Hooks and component usage

`hooks/use-auth-zustand.ts` exposes a small, composable surface:
- Selectors with `useShallow` to minimize re-renders.
- Permission helpers bound to `profile.role`.
- UI helpers for conditional rendering.

Usage example:

```tsx
import { useAuthZustand } from '@/hooks/use-auth-zustand'

function ExampleToolbar() {
  const { profile, ui, signOut, isInitialized } = useAuthZustand()
  if (!isInitialized || !profile) return null
  return (
    <div>
      {ui.canShowCreateButton('purchase_orders') && <button>New PO</button>}
      <button onClick={signOut}>Sign out</button>
    </div>
  )
}
```

Guidelines:
- Prefer local hooks that wrap store selectors; keep component code thin.
- Use `useShallow` or custom equality to avoid unnecessary renders.

---

## Initialization and auth event handling

`components/auth/auth-initializer.tsx` centralizes wiring:
- Calls `initialize()` once with timeout fallback.
- Subscribes to `supabase.auth.onAuthStateChange` and syncs state only (no redirects here; middleware handles routing).
- Sets up `online/offline` listeners to update the store.
- Optional: detects offline mode via `HEAD /api/health-check` headers and validates against persisted state.

Guidelines:
- Keep navigation/redirect logic out of the store; centralize in middleware/router.
- Avoid doing heavy work inside the auth state listener; only sync deltas.

---

## Middleware integration and controlled offline mode

The middleware integrates with Supabase SSR and controls access, aligning with the store’s offline capabilities:

- Uses `@supabase/ssr` with the required cookie pattern: only `cookies.getAll()` and `cookies.setAll(...)` with an updated `NextResponse`.
- Implements root redirect: `/` → `/dashboard` if authenticated, else `/login`.
- Defines public routes (e.g., `/login`, `/register`, `/auth/*`) and allows them without auth.
- Skips authentication for API routes (`/api/*`) since they validate independently.
- Enables an offline work mode for selected routes (`/checklists`, `/ordenes`, `/activos`, `/dashboard`, `/preventivo`, `/reportes`, `/incidentes`, `/modelos`, `/inventario`, `/plantas`, `/personal`, `/compras`) only if Supabase cookies (`sb-*`) are present to avoid unauthenticated bypasses that cause API 401s.
- When offline work mode is enabled, it sets response headers `X-Offline-Mode: true` and `X-Auth-Required: true`.
- The initializer checks these headers and allows offline access if persisted `user` and `profile` exist; otherwise it redirects to login.
- Always return the original `supabaseResponse` from middleware to keep cookies consistent.

Practical implications for the Zustand setup:
- Ensure `persist` includes only safe fields (`user`, `profile`, basic metadata) so offline validation can succeed without persisting sessions.
- The store should not perform redirects. Middleware controls navigation; the initializer only syncs state.
- API routes must continue to perform their own Supabase validation; do not rely on middleware for API auth.

---

## Mobile session recovery

`hooks/use-mobile-session-recovery.ts` provides helpers:
- `fetchWithSessionRecovery()`: On mobile, retries a failed request after attempting `recoverMobileSession()`.
- `ensureValidSession()`: Validates or attempts recovery on mobile devices before performing critical actions.

Guidelines:
- Gate behavior by device detection; keep desktop flows simple.
- Always retry the original request after successful recovery.

---

## Performance and stability practices (adopt these in any app)

- **Debounce/throttle**: Debounce auth checks and throttle high-frequency operations.
- **Proactive refresh**: Refresh tokens before expiry (~75% of lifetime).
- **Bound data structures**: Cap arrays (e.g., metrics, activity logs) to prevent memory leaks.
- **TTL caches**: Use `Map` with `{data,timestamp,ttl}`; prune regularly.
- **Timeout network calls**: Wrap network calls in `Promise.race` with a timeout to avoid hangs.
- **Selective persistence**: Persist only what you truly need; never persist timers or secrets.
- **Cross-tab hygiene**: Filter sync payloads; avoid re-broadcast on initial hydration; handle tab lifecycle cleanly.
- **Dynamic imports**: Break cycles for queue processors and services.

---

## Applying this pattern in a new web app (step-by-step)

1) Install dependencies

```bash
npm i zustand zustand/middleware
```

2) Define state types

```ts
// types/auth-store.ts (example)
export interface AuthState { user: User | null; profile: Profile | null; session: Session | null; isLoading: boolean; isInitialized: boolean; error: { code: string; message: string } | null; lastAuthCheck: number; authCheckSource: string }
export interface SessionState { activeTokenRefreshTimer: any; tokenExpiryWarningShown: boolean; sessionStartTime: number | null; sessionActivity: Array<{ timestamp: number; action: string; source: string }>; }
export interface CacheState { profileCache: Map<string, any>; sessionCache: Map<string, any>; cacheHits: number; cacheMisses: number }
export interface MetricsState { authLatency: number[]; sessionStability: number; offlineOperations: number; failedOperationsCount: number; lastMetricsUpdate: number }
export interface OfflineState { queue: any[]; isOnline: boolean; isSyncing: boolean; lastSyncTime: number | null; failedOperations: any[] }
export type AppStore = AuthState & SessionState & CacheState & MetricsState & OfflineState
```

3) Implement slices (auth/session/cache/metrics/offline)

- Mirror the responsibilities defined above; keep each slice small and testable.
- Add timeouts around I/O; update caches immediately on success.

4) Compose the store with `persist` and `devtools`

```ts
export const useAppStore = create<AppStore>()(
  devtools(
    persist((...args) => ({ /* spread slices */ }), { name: 'app-store', version: 1, partialize: (s) => ({ /* safe subset */ }) }),
    { name: 'AppStore' }
  )
)
```

5) Optional: Add cross-tab sync

- Introduce a middleware similar to `cross-tab-sync`.
- Sync only whitelisted keys; ignore updates during init.

6) Create lightweight hooks

- Wrap `useAppStore` with selector hooks using `useShallow`.
- Keep authorization and UI helpers colocated with the hook.

7) Add an initializer component

- Call `initialize()` once.
- Subscribe to your auth provider's events and mirror state changes.
- Add `online/offline` listeners and surface status via the store.

8) Provide a non-hook facade

- Expose `{ getState, setState, subscribe }` for services and queues.

9) Bake in metrics and health checks

- Track latency, stability, and cache hit rate; log warnings on thresholds.

10) Testing checklist

- Cold start: persisted user/profile fast-path works; no flashes.
- Cross-tab: login on Tab A reflects on Tab B within ~100ms, no loops.
- Token refresh: auto refresh occurs before expiry; no logout loops.
- Offline: queue captures ops; processing resumes when back online.
- Mobile: 401 → recovery → retry flow works.

---

## Anti-patterns to avoid

- Persisting `session`/tokens or timer handles.
- Triggering navigations/redirects from inside slices.
- Unbounded arrays for logs or metrics.
- Cross-tab broadcasting entire state or during initialization.
- Tight coupling between queue processors and the store (use dynamic imports).

---

## References (project)

- `store/index.ts`: store composition, persistence, utilities
- `store/slices/auth-slice.ts`: initialization, sign-in/out, profile load, recovery
- `store/slices/session-slice.ts`: proactive refresh, activity log
- `store/slices/cache-slice.ts`: TTL caches and pruning
- `store/slices/metrics-slice.ts`: latency, stability, summary
- `store/slices/offline-slice.ts`: queue with retries, online/offline handling
- `store/middleware/cross-tab-sync.ts`: BroadcastChannel sync
- `hooks/use-auth-zustand.ts`: selector-based consumption and UI helpers
- `hooks/use-mobile-session-recovery.ts`: mobile recovery helpers
- `components/auth/auth-initializer.tsx`: initialization and event wiring

---

## Final notes

This pattern scales well for auth-centric apps and any domain requiring robust client state. It is intentionally conservative about persistence and aggressively defensive against instability (timeouts, bounded structures, proactive refresh). Adopt incrementally: start with slices and persistence, then add cross-tab and offline capabilities as your requirements mature.


