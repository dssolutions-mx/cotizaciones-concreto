## Auth/Session Migration Plan to Zustand

### 1) Executive summary
- **Goal**: Replace imperative `AuthContext` session handling with a robust, slice-based Zustand store to eliminate forced refreshes, fix session drift, add cross-tab sync, and improve UX.
- **Approach**: Introduce a new `useAuthStore` (slices: auth, session, cache, metrics, offline) with `persist(partialize)`, `devtools`, `subscribeWithSelector`, and a `BroadcastChannel` cross-tab sync middleware. Wire via an `AuthInitializer`. Migrate incrementally using a bridge to avoid breaking existing `useAuth` consumers.
- **Outcomes**: Stable session management (proactive refresh), fewer hydration issues, no manual page reloads, safer persistence, and improved diagnostics.

### 2) Scope and non‑goals
- **In scope**: Client-side auth/session state, cross-tab sync, safe persistence, initializer wiring, component migration, metrics & health, offline queue scaffolding.
- **Out of scope**: Server-side Supabase SSR changes, API route auth policies (remain as-is), redesign of role/permission model.

### 3) Directory structure (new)
```
src/
  store/
    auth/
      index.ts                 # compose store + middleware
      types.ts                 # store types (AuthState, SessionState, etc.)
      slices/
        auth-slice.ts
        session-slice.ts
        cache-slice.ts
        metrics-slice.ts
        offline-slice.ts
      middleware/
        cross-tab-sync.ts      # BroadcastChannel-based
  hooks/
    use-auth-zustand.ts        # selector-based consumption + helpers
  components/auth/
    auth-initializer.tsx       # store initialize + auth events (client)
  adapters/
    auth-context-bridge.ts     # optional bridge to mimic useAuth
```

### 4) Dependencies
```bash
npm i zustand
```
Optional (later if needed): `zustand/traditional`, `zustand/vanilla/shallow`.

### 5) Store design
- **Slices**
  - auth-slice: `user`, `profile`, `error`, `isInitialized`, `initialize()`, `signIn()`, `signOut()`, `loadProfile()`, `refreshProfile()`
  - session-slice: `session`, proactive token refresh scheduling (~75%), `isSessionExpiringSoon()`
  - cache-slice: small TTL caches (profile/session) + hit/miss counters
  - metrics-slice: `authLatency[]` (bounded), `sessionStability`, `failedOperationsCount`, `getMetricsSummary()`
  - offline-slice: queue with retries, `processQueue()`, `setOnlineStatus()`

- **Middleware pipeline**
  - `devtools`
  - `persist` with `partialize` to store only safe fields:
    - Persist: `user`, `profile`, `lastAuthCheck`, `authCheckSource`, `cacheHits`, `cacheMisses`, `queue`, `failedOperations`, `lastSyncTime`
    - Do NOT persist: `session`, tokens, timers, internal handles
    - Add `version` and `migrate` to future-proof
  - `subscribeWithSelector` for granular subscriptions (metrics, health)
  - `cross-tab-sync` middleware (BroadcastChannel), whitelisting `['user','profile','session']` and preventing loops

### 6) Initializer and wiring
- Add `components/auth/auth-initializer.tsx` to:
  - `store.initialize()` on mount (once)
  - subscribe to `supabase.auth.onAuthStateChange`
  - update store deltas only (no routing)
  - listen `online/offline` → update offline slice
- Update `src/app/layout.tsx` to render `<AuthInitializer />` near the top (client). Keep existing `SessionManager` during migration, then remove.

### 7) Bridge strategy (zero-downtime migration)
- Create `adapters/auth-context-bridge.ts` exporting functions with the same shape as `useAuth` (where feasible) but backed by `useAuthStore`.
- Phase 1: New features/components consume `use-auth-zustand` selectors.
- Phase 2: Migrate high-impact components (e.g., `ProfileMenu`, `AuthStatusIndicator`, guards) to selectors.
- Phase 3: Convert remaining `useAuth` consumers to bridge or direct selectors.
- Phase 4: Remove `AuthContext` and `SessionManager` once usage hits 0.

### 8) Rollout plan (phased)
1. Foundation
   - Add store + slices + middleware
   - Add `AuthInitializer` and mount in `layout.tsx`
   - Keep `AuthContext` intact
2. Dual-run & validation
   - Ensure store and context stay in sync (during this phase only)
   - Add metrics/health logging via `subscribeWithSelector`
3. Component migration
   - Migrate `AuthStatusIndicator`, `ProfileMenu`, `RoleGuard`, `PlantSelectionGuard`
   - Replace `triggerAuthCheck` calls with store actions
4. Cleanup
   - Remove `SessionManager` and `AuthContext` provider
   - Swap remaining helpers (`hasRole`) to store-based versions

### 9) File touchpoints (initial)
- Keep: `src/lib/supabase/client.ts` (singleton for store actions)
- Add: `src/store/auth/**`, `src/hooks/use-auth-zustand.ts`, `src/components/auth/auth-initializer.tsx`, `src/store/auth/middleware/cross-tab-sync.ts`, optional `src/adapters/auth-context-bridge.ts`
- Edit: `src/app/layout.tsx` to include `AuthInitializer`

### 10) Testing plan
- Auth flows
  - Sign in/out: state updates correctly; no reloads needed
  - Token refresh at ~75% lifetime; `AuthStatusIndicator` reflects timing
  - `getUser` fast-path from persisted profile (without persisting session)
- Cross-tab
  - Login in Tab A updates Tab B within ~100–300ms; no broadcast loops
  - Sign out in one tab clears all tabs
- Hydration/SSR safety
  - No hydration warnings; guard UI on `persist.hasHydrated()` when needed
- Offline
  - Queue captures actions offline; processes on reconnection
- Performance
  - Use `useShallow` selectors for top-level menus/toolbars to prevent churn

### 11) Monitoring & metrics
- Log:
  - last successful auth refresh timestamp
  - auth latency EMA
  - cache hit/miss ratio
  - offline queue depth and failures
- Add a lightweight `/api/health-check` ping to confirm cookie presence when online

### 12) Rollback strategy
- If regressions emerge, disable `AuthInitializer` in `layout.tsx` and revert caller components to `useAuth` quickly (bridge lets us toggle per-component).

### 13) Acceptance criteria
- No forced page refreshes required for session updates
- Cross-tab auth state consistency
- No persisted secrets/sessions
- Stable token refresh without logout loops
- No hydration warnings in Next.js App Router

### 14) Developer checklist
- [x] Install `zustand`
- [x] Add `src/store/auth/` with slices and middleware
- [x] Implement `persist(partialize, version, migrate)`
- [x] Implement `cross-tab-sync` (BroadcastChannel)
- [x] Implement `AuthInitializer` and mount it in `layout.tsx`
- [x] Add `hooks/use-auth-zustand.ts`
- [x] Bridge or migrate `AuthStatusIndicator`, `ProfileMenu`, `RoleGuard`, `PlantSelectionGuard` (AuthStatusIndicator/ProfileMenu/RoleGuard migrated; PlantSelectionGuard N/A)
- [ ] Remove `SessionManager` and `AuthContext` when all consumers migrated
- [ ] Add tests for sign-in/out, refresh, cross-tab, offline queue

### 15) References
- Persisting store data: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
- Setup with Next.js: https://zustand.docs.pmnd.rs/guides/nextjs
- Slices Pattern: https://zustand.docs.pmnd.rs/guides/slices-pattern
- Prevent re-renders with useShallow: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
- subscribeWithSelector: https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector


