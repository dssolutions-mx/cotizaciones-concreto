# Static Code Security Review — Cotizaciones Concreto

**Date:** 2025-03-17  
**Phase:** Step 2 — Static Code Security Review  
**Architecture Context:** Next.js 16 B2B SaaS, Supabase Auth + @supabase/ssr, multi-tenant, RBAC  
**ASVS Level:** L2 (Standard)

---

## Findings

### 1. Authentication & Session Management (OWASP A07, ASVS V2/V3)

**[FINDING-001]: Server-side use of getSession() instead of getUser()** — **Status: FIXED (services)**
- **Severity:** High (fixed in services)
- **OWASP:** A07 — Identification and Authentication Failures
- **ASVS:** V2.1.4
- **Location (fixed):** 
  - `src/services/qualityEnsayoService.ts` — now uses `getUser()`
  - `src/services/quotes.ts` — now uses `getUser()`
  - `src/services/orderService.ts` — now uses `getUser()`
- **Location (client-only; acceptable):** `MaterialTechnicalSheetManager.tsx`, `MaterialSafetySheetManager.tsx` — client components that use `getSession()` to obtain the Bearer token for API calls. The API validates with `getUser(token)`, so this is acceptable.
- **Evidence:** Services used `supabase.auth.getSession()` for user identity. `getSession()` reads from storage without revalidating; `getUser()` validates with the auth server.
- **Remediation (done):** Replaced `getSession()` with `getUser()` in all three services.
```typescript
// ❌ Before
const { data: authData } = await supabase.auth.getSession();
if (!authData.session?.user?.id) { ... }

// ✅ After
const { data: { user }, error } = await supabase.auth.getUser();
if (!user?.id) { ... }
```

---

**[FINDING-002]: create-profile route: manual cookie parsing and no JWT verification** — **Status: FIXED**
- **Severity:** High (fixed)
- **OWASP:** A07 — Identification and Authentication Failures
- **ASVS:** V2.1.1
- **Location:** `src/app/api/auth/create-profile/route.ts`
- **Evidence:** The route extracts user ID and email by manually parsing the auth cookie (base64 decode + JSON parse) without verifying JWT signature or expiry. There is no call to `supabase.auth.getUser()`.
- **Impact:** Reliance on unverified cookie content could allow session forgery or tampering if an attacker can influence cookie values. Combined with mass assignment of `role`, this increases privilege escalation risk.
- **Remediation:** Use the standard Supabase server client and `getUser()`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient(); // use @supabase/ssr
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;
  const userEmail = user.email ?? '';
  // ... rest of logic using userId from verified session
}
```

---

**[FINDING-003]: create-profile allows client-supplied role — privilege escalation** — **Status: FIXED**
- **Severity:** Critical (fixed)
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.3
- **Location:** `src/app/api/auth/create-profile/route.ts:109,133`
- **Evidence:** The route accepts `{ firstName, lastName, role }` from `request.json()` and upserts with `role: role || 'SALES_AGENT'`. There is no allowlist or server-side check on `role`.
- **Impact:** A newly signed-up user can call this endpoint with `role: 'ADMIN'` or `role: 'EXECUTIVE'` and escalate their privileges.
- **Remediation:** 
  1. Do not accept `role` from the client for new profiles.
  2. Set a default role (e.g. `SALES_AGENT`) server-side.
  3. If roles must be configurable, restrict to admin-only endpoints and validate against an allowlist:
```typescript
const ALLOWED_DEFAULT_ROLES = ['SALES_AGENT', 'QUALITY_TEAM'];
const role = ALLOWED_DEFAULT_ROLES.includes(body.role) ? body.role : 'SALES_AGENT';
// Or: only admins can set role via a separate admin endpoint.
```

---

**[FINDING-004]: auth/test-admin uses deprecated getSession() and auth-helpers-nextjs**
- **Severity:** Medium
- **OWASP:** A07 — Identification and Authentication Failures
- **ASVS:** V2.1.4
- **Location:** `src/app/api/auth/test-admin/route.ts:68, createRouteHandlerClient`
- **Evidence:** Uses deprecated `@supabase/auth-helpers-nextjs` and `getSession()` instead of `getUser()`. Returns debug information including cookie header substring.
- **Impact:** In development, session forgery and information disclosure are more likely. Production returns 404, mitigating exposure.
- **Remediation:** Remove or refactor this route: use `@supabase/ssr` and `getUser()`, and avoid returning cookie/debug data to the client.

---

### 2. Authorization & Access Control (OWASP A01, ASVS V4)

**[FINDING-005]: API routes missing explicit role checks**
- **Severity:** Medium
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.1
- **Location:** Several routes use `getUser()` but do not consistently check `user_profiles.role`. Examples: `src/app/api/po/route.ts`, `src/app/api/ap/payables/route.ts`, `src/app/api/governance/pending/route.ts`.
- **Evidence:** Some routes verify `profile.role` against allowed roles; others only check `user`. Without RLS or explicit role checks, any authenticated user may access these endpoints.
- **Impact:** Horizontal or vertical privilege escalation if RLS is incomplete or misconfigured.
- **Remediation:** For every protected API route, load the user profile and enforce role requirements:
```typescript
const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
const allowed = ['ADMIN', 'EXECUTIVE'];
if (!profile?.role || !allowed.includes(profile.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 3. Input Validation & Injection (OWASP A03, ASVS V5)

**[FINDING-006]: Limited input validation with Zod**
- **Severity:** Medium
- **OWASP:** A03 — Injection
- **ASVS:** V5.1.3
- **Location:** Zod is used in `src/app/api/inventory/entries/route.ts`, `src/app/api/client-portal/team/[userId]/route.ts`, and a few others. Many routes accept `request.json()`, `formData`, or `searchParams` without schema validation.
- **Evidence:** Routes such as `src/app/api/finanzas/client-payments/route.ts`, `src/app/api/suppliers/route.ts`, and others parse request bodies without Zod or similar validation.
- **Impact:** Malformed or unexpected input may cause runtime errors, bypass validation, or enable injection. Unbounded strings can contribute to DoS.
- **Remediation:** Validate all API inputs with Zod (or equivalent):
```typescript
const bodySchema = z.object({
  amount: z.number().positive(),
  targetClientId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});
const body = bodySchema.parse(await request.json());
```

---

**[FINDING-007]: Batch size from URL without bounds validation**
- **Severity:** Low
- **OWASP:** A04 — Insecure Design
- **ASVS:** V5.1.4
- **Location:** `src/app/api/geocode/backfill/route.ts:34`
- **Evidence:** `batch_size` is read from query params as `parseInt(url.searchParams.get('batch_size') ?? '25', 10)` and passed to `Math.min(25, Math.max(1, ...))`. Negative or non-numeric values are partially handled, but other routes may not validate numeric ranges.
- **Impact:** Minor; this route is already constrained. Use as a pattern for other numeric parameters.
- **Remediation:** Validate numeric params with Zod or explicit range checks across all routes that accept query parameters.

---

### 4. Cryptography (OWASP A02, ASVS V6)

**[FINDING-008]: JWT_SECRET fallback to service role key**
- **Severity:** Medium
- **OWASP:** A02 — Cryptographic Failures
- **ASVS:** V6.2.1
- **Location:** `src/app/api/credit-actions/process/route.ts:8`, `quote-actions/process`, `governance-actions/process`
- **Evidence:** `JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || supabaseServiceKey`. Falling back to the service role key is discouraged; it mixes concerns and increases exposure.
- **Impact:** If the service role key is used as JWT secret, its compromise affects both database access and JWT verification.
- **Remediation:** Require a dedicated JWT secret and fail if missing:
```typescript
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('SUPABASE_JWT_SECRET or JWT_SECRET must be set');
}
```

---

**[FINDING-009]: Non-cryptographic RNG for quote numbers**
- **Severity:** Low
- **OWASP:** A02 — Cryptographic Failures
- **ASVS:** V6.2.2
- **Location:** `src/services/quotes.ts:283`
- **Evidence:** `Math.floor(Math.random() * 9000) + 1000` is used for quote number generation.
- **Impact:** Quote numbers may be somewhat predictable. For business IDs this is usually low risk.
- **Remediation:** Prefer `crypto.randomInt(1000, 10000)` for stronger unpredictability if quote uniqueness or guessing matters.

---

### 5. Error Handling (OWASP A09, ASVS V7)

**[FINDING-010]: Supabase and internal error details returned to clients**
- **Severity:** Medium
- **OWASP:** A09 — Security Logging and Monitoring Failures
- **ASVS:** V7.4.1
- **Location:** Multiple files, including:
  - `src/app/api/quality/ensayos/route.ts:69` — `${error.message}`
  - `src/app/api/quality/evidencias/route.ts:48` — `${error.message}`
  - `src/app/api/plants/certificates/route.ts:67,90,131,196` — `uploadError.message`, `insertError.message`, etc.
  - `src/app/api/auth/create-profile/route.ts:155` — `details: profileError.message`
  - `src/app/api/remisiones/[id]/allocate-fifo/route.ts:109,125` — `error.message`, `details: error.message`
  - `src/app/api/inventory/entries/route.ts` — `details: error.message` in several branches
  - `src/components/clients/BalanceAdjustmentModal.tsx:429` — `error.hint` shown to user
- **Evidence:** Supabase errors (message, hint, code) and other internal details are passed to the client.
- **Impact:** Clients can learn about schema, constraints, and internal logic. Useful for reconnaissance and targeted attacks.
- **Remediation:** Return generic messages to clients; log full errors server-side only:
```typescript
console.error('DB error:', error);
return NextResponse.json({ error: 'Operation failed. Please try again.' }, { status: 500 });
```

---

### 6. Software Integrity (OWASP A08)

**[FINDING-011]: No webhook signature verification**
- **Severity:** Informational
- **OWASP:** A08 — Software and Data Integrity Failures
- **ASVS:** V13.1.1
- **Location:** Database webhooks call Edge Functions (`handle_credit_validation_webhook`, `handle_ensayo_notification_webhook`). Incoming webhooks from external services (e.g. Stripe, GitHub) are not present in the reviewed scope.
- **Evidence:** Database-triggered webhooks and internal flows were reviewed. If external webhooks are added, they must verify signatures.
- **Impact:** N/A for current scope.
- **Remediation:** For any future external webhooks, verify signatures (e.g. Stripe `stripe.webhooks.constructEvent`) before processing.

---

### 7. Cross-Site Scripting (OWASP A03, ASVS V5)

**[FINDING-012]: innerHTML usage in LocationSearchBox**
- **Severity:** Low
- **OWASP:** A03 — Injection
- **ASVS:** V5.4.3
- **Location:** `src/components/maps/LocationSearchBox.tsx:184`
- **Evidence:** `container.innerHTML = ''` is used to clear the container before appending `autocompleteElement`. The content is not user-controlled.
- **Impact:** Low; this is a clear-then-append pattern without untrusted input.
- **Remediation:** Prefer DOM APIs where possible, e.g. `container.textContent = ''` or `container.replaceChildren()` for clarity.

---

**[FINDING-013]: No CSP configuration found**
- **Severity:** Low
- **OWASP:** A03 — Injection
- **ASVS:** V5.4.4
- **Location:** `next.config.js` (no CSP headers observed)
- **Evidence:** No Content-Security-Policy headers found in configuration.
- **Impact:** XSS defenses rely only on careful output encoding; no defense-in-depth from CSP.
- **Remediation:** Add CSP headers in Next.js config or middleware:
```javascript
headers: [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
  }
]
```

---

### 8. Client Storage & Token Handling (ASVS V3)

**[FINDING-014]: Auth store persisted to localStorage**
- **Severity:** Low
- **OWASP:** A03 — Injection (via XSS)
- **ASVS:** V3.2.1
- **Location:** `src/store/auth/index.ts:50`, `src/store/auth/unified-store.ts:65`
- **Evidence:** Auth state is persisted to localStorage via Zustand `persist`. The `partialize` excludes tokens (only `user.id`, `user.email`, `profile`, cache stats are stored).
- **Impact:** Tokens are not in localStorage, but profile and user identifiers are. XSS could read this data. Risk is lower since tokens are excluded.
- **Remediation:** Consider using httpOnly cookies for session storage. If localStorage is retained, ensure profile data is not sensitive and that XSS mitigations (input sanitization, CSP) are in place.

---

### 9. TypeScript Hygiene

**[FINDING-015]: Widespread use of `any` and type assertions**
- **Severity:** Low
- **OWASP:** N/A (code quality)
- **ASVS:** V5.1.1
- **Location:** Examples: `src/hooks/useProgressiveRecipeAnalysis.ts`, `src/components/arkik/DebugArkikValidator.tsx`, `src/components/materials/EditMaterialModal.tsx`, others.
- **Evidence:** Many `as any` casts and `any` types, especially for API responses and dynamic data.
- **Impact:** Unvalidated external data can be used without type safety, increasing risk of runtime errors and security issues.
- **Remediation:** Define types for API responses and validate with Zod where possible; avoid `as any` on unvalidated data.

---

### 10. Configuration & Build

**[FINDING-016]: Placeholder keys in api.ts for build**
- **Severity:** Low
- **OWASP:** A05 — Security Misconfiguration
- **ASVS:** V6.1.1
- **Location:** `src/lib/supabase/api.ts:5-7`
- **Evidence:** `SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build'` and similar for URL and anon key.
- **Impact:** If build artifacts or logs leak, placeholders could be exposed. Service role key must never be in client bundles.
- **Remediation:** Use build-time checks to ensure real keys are set in non-placeholder builds and that service role key is never bundled for the client.

---

### 11. Service Role Usage

**[FINDING-017]: Service role used in many API routes**
- **Severity:** Informational
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.1
- **Location:** 30+ API routes use `createClient` with `SUPABASE_SERVICE_ROLE_KEY`.
- **Evidence:** Routes in `credit-actions`, `quote-actions`, `governance-actions`, `auth`, `admin`, backfills, etc.
- **Impact:** Service role bypasses RLS. If used for user-scoped data, RLS is ineffective. For admin operations and backfills this is expected.
- **Remediation:** Ensure each use of service role is justified. Prefer the anon key with RLS for user-scoped operations. Regularly audit new routes for correct client choice.

---

## Static Review Summary

| ID    | Severity    | Category              | Title                                                                 |
|-------|-------------|------------------------|-----------------------------------------------------------------------|
| 001   | High        | Auth & Session         | Server-side getSession() instead of getUser()                         |
| 002   | High        | Auth & Session         | create-profile: manual cookie parsing, no JWT verification (Fixed)     |
| 003   | Critical    | Authorization          | create-profile allows client-supplied role (privilege escalation) (Fixed) |
| 004   | Medium      | Auth & Session         | auth/test-admin uses deprecated getSession() and auth-helpers         |
| 005   | Medium      | Authorization          | API routes missing explicit role checks                               |
| 006   | Medium      | Input Validation       | Limited input validation (Zod) across API routes                      |
| 007   | Low         | Input Validation       | Batch size from URL without full bounds validation                   |
| 008   | Medium      | Cryptography           | JWT_SECRET fallback to service role key                               |
| 009   | Low         | Cryptography           | Non-cryptographic RNG for quote numbers                               |
| 010   | Medium      | Error Handling         | Supabase/internal error details returned to clients                  |
| 011   | Info        | Software Integrity     | Webhook signature verification (future external webhooks)              |
| 012   | Low         | XSS                    | innerHTML usage in LocationSearchBox                                 |
| 013   | Low         | XSS                    | No CSP configuration                                                 |
| 014   | —           | Client Storage         | Auth store persisted to localStorage (Reframed: not a finding)         |
| 015   | Low         | TypeScript             | Widespread `any` and type assertions                                 |
| 016   | Low         | Configuration          | Placeholder keys in api.ts for build                                  |
| 017   | Info        | Authorization          | Service role usage review                                             |

---

**Total findings:** 17 (Critical: 1, High: 2, Medium: 5, Low: 7, Info: 2). FINDING-002 and FINDING-003 are fixed; FINDING-014 reframed.

---

## Priority Remediation Order

1. ~~**[FINDING-003]**~~ — FIXED: create-profile no longer accepts client-supplied role.
2. ~~**[FINDING-002]**~~ — FIXED: create-profile now uses `getUser()`.
3. **[FINDING-001]** — Replace server-side `getSession()` with `getUser()`.
4. **[FINDING-010]** — Stop returning Supabase/internal error details to clients.
5. **[FINDING-005]** — Add role checks to routes that currently only verify authentication.
6. **[FINDING-008]** — Do not fall back to service role key for JWT_SECRET.
7. **[FINDING-006]** — Add Zod (or similar) validation for API inputs.

---

---

## Assessment Corrections (2025-03-17)

- **RLS on clients, construction_sites, client_balances:** Verified via Supabase MCP `pg_policies` query — no `USING(true)` on these tables. Policies are role-scoped (internal roles + EXTERNAL_CLIENT scoped by client_portal_users). See AUTH_AUTHZ_DEEP_DIVE.md for corrected RLS coverage.
- **FINDING-002** (create-profile manual cookie) and **FINDING-003** (create-profile client-supplied role) were fixed in a prior session.
- **FINDING-014** (Zustand/localStorage): Reframed — Zustand persist is intentional; server-side getUser() used for auth. Not a finding.

---

*Report produced for use in the next phase of the AppSec pipeline (threat modeling / report compilation).*
