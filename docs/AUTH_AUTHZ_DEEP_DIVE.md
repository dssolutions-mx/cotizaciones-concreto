# Authentication & Authorization Deep-Dive Report

**Date:** 2025-03-17  
**Phase:** Step 6 — Authentication & Authorization Deep-Dive (AppSec Pipeline)  
**Workspace:** cotizaciones-concreto  
**Context:** Supabase Auth, @supabase/ssr + deprecated auth-helpers-nextjs, service_role in ~30+ routes, RLS, roles in app_metadata vs user_profiles  
**ASVS Level:** L2 (Standard)

> **Note:** create-profile and clients/details were fixed in a prior assessment session.

---

## Executive Summary

The application uses **Supabase Auth** with a mix of secure and insecure patterns. **create-profile** and **clients/[id]/details** were fixed in a prior session (now use `getUser()`; role derived server-side; clients/details requires auth). Several paths still use `getSession()` instead of `getUser()` for auth decisions. The proxy (Next.js 16 middleware) still uses deprecated `@supabase/auth-helpers-nextjs`. Roles are stored in `user_profiles` (database) and checked server-side from that table—**not** `app_metadata`. RLS coverage varies by table; clients, construction_sites, and client_balances use role-scoped policies (verified via Supabase MCP).

---

## Part 1 — Authentication Assessment

### 1.1 Identity Verification

**Status:** **Issues Found**

| Check | Status | Evidence |
|-------|--------|----------|
| Protected handlers use `getUser()` | Partial | ~70 routes use `getUser()` ✅; several use `getSession()` ❌ |
| User null-checked before proceeding | Partial | Many routes check `!user`; some omit error handling |
| `getUser()` error handled (401) | Partial | Some return 401 on error; others proceed |
| createServerClient from @supabase/ssr | Partial | `createServerSupabaseClient()` uses @supabase/ssr ✅; `create-profile` FIXED: now uses `getUser()` ✅ |

**getSession() usage (server-side auth decisions — INSECURE):**

| Location | Context |
|----------|---------|
| `src/components/quotes/ApprovedQuotesTab.tsx:542` | Client component; still should prefer getUser for API calls |
| `src/components/quality/MaterialTechnicalSheetManager.tsx:71,126,176` | Client; uses session for Bearer token — API validates |
| `src/components/quality/MaterialSafetySheetManager.tsx:71,126,176` | Same pattern |
| `src/services/qualityEnsayoService.ts:60` | Service layer; uses getSession for user ID |
| `src/app/(auth)/auth/callback/page.tsx` | OAuth callback; getSession for redirect logic (client-side) |
| `src/store/auth/slices/auth-slice.ts:22,126` | Client-side auth state |

**getUser() usage (correct):** Most API routes in `src/app/api/**` use `auth.getUser()` correctly.

**create-profile (FIXED):** Now uses `getUser()` for authoritative identity verification; role derived server-side from `user_metadata` or default to SALES_AGENT. Client-supplied role rejected.

**createServerClient:** `createServerSupabaseClient()` in `server.ts` correctly uses `@supabase/ssr` with `get`/`set`/`remove` cookie methods. Note: `.cursor/rules` recommend `getAll`/`setAll`; current pattern is valid per Supabase SSR docs.

---

### 1.2 Password Security

**Status:** **N/A (Supabase Auth)**

Passwords are delegated to Supabase Auth. No custom hashing, reset logic, or policy in app code.

---

### 1.3 Multi-Factor Authentication (MFA)

**Status:** **Not Implemented**

- No MFA-specific code found (TOTP, FIDO2, backup codes).
- Supabase supports MFA via project settings; not evident in codebase.
- **NIST AAL2:** Requires MFA for sensitive data/admin operations. Gap: MFA not required for EXECUTIVE/ADMIN_OPERATIONS.

---

### 1.4 OAuth / Social Sign-In

**Status:** **Partially Reviewed**

- **Callback:** `src/app/(auth)/auth/callback/page.tsx` handles `token_hash`, `code`, `access_token`/`refresh_token` in hash.
- **state param:** Not explicitly validated in callback (Supabase handles internally).
- **redirect_uri:** Controlled by Supabase dashboard; ensure allowlist is restricted.
- **Account linking:** Supabase may auto-link by email; review dashboard settings for safe behavior.

---

## Part 2 — Session Management Assessment

### 2.1 Token and Cookie Security

| Check | Status | Evidence |
|-------|--------|----------|
| HttpOnly cookies | Mixed | Supabase @supabase/ssr uses cookies; browser client uses `createBrowserClient` which defaults to localStorage for tokens in some setups |
| Secure (HTTPS only) | Assumed | Supabase cookie options not explicitly set; default behavior |
| SameSite | Assumed | Supabase defaults |
| Tokens in localStorage | Yes | Browser client: `createBrowserClient` from @supabase/ssr; `persistSession: true`. Supabase stores tokens; XSS could steal if not HttpOnly |

**Note:** Supabase SSR for Next.js typically stores session in cookies when using server client. Browser client may use localStorage—verify Supabase docs for `createBrowserClient` storage.

### 2.2 Token Lifetime and Invalidation

- **JWT expiry:** Supabase default (e.g. 3600s).
- **Refresh rotation:** Supabase handles.
- **Logout scope:** `signOut()` called client-side; scope (`local`/`global`/`others`) not explicitly set in codebase.

### 2.3 Session Fixation

- Supabase issues new tokens on login; session fixation mitigated by Supabase Auth.

---

## Part 3 — Authorization Assessment

### 3.1 RLS Coverage Table

| Table | RLS Enabled | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|-------------|--------|--------|--------|--------|-------|
| user_profiles | ✅ | ✅ | ✅ (EXECUTIVE) | ✅ (own/EXECUTIVE) | ✅ (EXECUTIVE) | fix_recursive_policies; users can view all profiles |
| orders | ✅ | ✅ | ✅ | ✅ | — | Multiple policies by role; orders_tables has `USING(TRUE)` for SELECT (overly broad) |
| order_items | ✅ | ✅ | ✅ | — | — | orders_tables |
| order_notifications | ✅ | ✅ | ✅ (service_role) | — | — | service_role only for INSERT |
| material_entries | ✅ | ✅ | ✅ | ✅ | ✅ | Plant/BU scoped |
| material_adjustments | ✅ | ✅ | ✅ | — | — | 20250120 |
| material_inventory | ✅ | ✅ | ✅ | ✅ | — | 20250120 |
| muestreos, muestras, ensayos | ✅ | ✅ | ✅ | ✅ | — | 20250119, auth.uid() scoped |
| evidencias, alertas_ensayos | ✅ | ✅ | ✅ | — | — | 20250119 |
| recipes, recipe_versions, recipe_reference_materials | ✅ | ✅ | ✅ | — | — | QUALITY_TEAM/EXECUTIVE |
| limites_granulometricos | ✅ | ✅ | ✅ | ✅ | — | Role-based |
| alta_estudio, estudios_seleccionados | ✅ | ✅ | ✅ | ✅ | ✅ | Role-based |
| arkik_material_mapping | ✅ | ✅ | ✅ | ✅ | ✅ | Role-based |
| arkik_import_sessions | ✅ | ✅ | ✅ | ✅ | — | Plant-assigned |
| waste_materials | ✅ | ✅ | ✅ | — | — | Plant-assigned |
| remision_reassignments | ✅ | ✅ | ✅ | ✅ | — | Plant-assigned |
| credit_action_tokens | ✅ | ✅ | — | — | — | service_role can manage |
| product_prices | ✅ | ✅ | ✅ | — | — | quality_team_executive for write |
| clients | ✅ (docs) | ✅ | — | — | — | clients_all_roles_access (internal roles) + external_client_clients_read_multi_user (EXTERNAL_CLIENT scoped by client_portal_users) |
| construction_sites | ✅ (docs) | ✅ | — | — | — | construction_sites_all_roles_select (internal) + external_client_construction_sites_read (client_id = get_user_client_id()) |
| client_balances | ✅ (docs) | ✅ | ? | ? | — | client_balances_all_roles_select (internal) + external_client_client_balances_read (EXTERNAL_CLIENT scoped) |
| client_payments | — | — | — | — | — | Verify RLS; external_client policies in docs |
| client_portal_users | — | — | — | — | — | Multi-user portal; verify policies |

**Tables with rowsecurity=false or no RLS (flag for review):** client_payments, other financial tables—confirm via `pg_tables`/`pg_policies`.

**Overly permissive policies:** orders SELECT in orders_tables uses `USING (TRUE)`; new_roles policies layer on top. Multiple policies OR together—verify least privilege.

**Note:** RLS on `clients`, `construction_sites`, and `client_balances` was verified via Supabase MCP `pg_policies` query—no `USING(true)` on these tables.

---

### 3.2 Server-Side Authorization Checks

**service_role usage:** 30+ routes use `createClient(..., SUPABASE_SERVICE_ROLE_KEY)` or `createAdminClientForApi()`.

| Route Pattern | Explicit Ownership/Role Check |
|---------------|-------------------------------|
| create-user | ✅ EXECUTIVE or ADMIN_OPERATIONS from user_profiles |
| invite-user | ✅ Same |
| create-profile | ✅ FIXED: uses getUser(); role derived server-side |
| admin/client-portal-users | ✅ EXECUTIVE/ADMIN_OPERATIONS |
| quotes/approve | ✅ APPROVAL_ROLES |
| po/*, ap/* | ✅ profile.role in allowed list |
| clients/[id]/details | ✅ FIXED: requires auth (getUser); returns 401 if unauthenticated |
| materials/safety-sheets, technical-sheets | ✅ Bearer token + getUser(token); QUALITY_TEAM/EXECUTIVE |

**Recommendation:** Audit every service_role route; ensure explicit `getUser()` + profile role check before admin operations.

---

### 3.3 Role Architecture

- **Storage:** Roles in `user_profiles.role` (database), not `auth.users.app_metadata.role`.
- **Consistency:** Server-side checks use `user_profiles` via `supabase.from('user_profiles').select('role').eq('id', user.id).single()`.
- **Trust boundary:** `user_profiles.role` is authoritative; set by EXECUTIVE or on create-user/invite (server-side). **create-profile** FIXED: now derives role server-side from user_metadata or default; client-supplied role rejected.
- **Default-deny:** RLS uses role checks; clients, construction_sites, and client_balances are properly scoped (verified). orders SELECT may be broad.

---

### 3.4 Fine-Grained Authorization

- **Permission model:** Role-based (SALES_AGENT, EXECUTIVE, PLANT_MANAGER, etc.).
- **Multi-tenancy:** Client portal uses `client_portal_users` association; `portal_user_id` on clients for single-user; multi-user via associations.
- **Client portal isolation:** Policies gate by `client_portal_users` and `portal_user_id`.

---

## NIST 800-63 Alignment Summary

| Area | Current State | Required for AAL2 | Gap |
|------|---------------|-------------------|-----|
| Multi-factor authentication | None | Required for sensitive/admin | Implement TOTP MFA for EXECUTIVE/ADMIN |
| Password handling | Supabase (NIST-aligned) | N/A | — |
| Session management | Cookies + localStorage | Active session timeout | Verify Supabase idle timeout |
| Identity verification | getUser() in most routes | Server-side JWT verify | create-profile FIXED; fix remaining getSession paths |
| Session fixation | Supabase handles | — | — |

---

## ASVS Coverage

| ASVS Section | Level | Status |
|--------------|-------|--------|
| V2 Authentication | L2 | **Below** — create-profile FIXED; getSession in some paths; no MFA |
| V3 Session Management | L2 | **Partial** — Token storage mixed; logout scope not explicit |
| V4 Access Control | L2 | **Below** — create-profile privilege escalation; clients/[id]/details unauthenticated (both fixed); clients/construction_sites/client_balances RLS verified correct |

---

## Priority Remediation

1. ~~**create-profile:**~~ FIXED — uses `getUser()`; role derived server-side.
2. ~~**clients/[id]/details:**~~ FIXED — requires auth; returns 401 if unauthenticated.
3. **Replace getSession with getUser** in server-side/auth decision paths (High).
4. **Migrate proxy.ts** from auth-helpers-nextjs to @supabase/ssr (Medium).
5. **MFA for admin roles** (Medium; NIST AAL2).
6. **Audit RLS** for remaining `USING (true)` policies (e.g., orders_tables); clients, construction_sites, client_balances verified correct.

---

---

## Implemented Fixes (This Session)

1. **create-profile** — Refactored to:
   - Use `createServerSupabaseClient()` + `getUser()` for authoritative identity verification (no manual cookie parsing)
   - Reject client-supplied `role`; derive role from `user_metadata` (invite flow) or default to `SALES_AGENT`
   - Allow `EXTERNAL_CLIENT` only when `user_metadata.invited` and `user_metadata.role` match allowlist

2. **clients/[id]/details** — Added `getUser()` check; returns 401 if unauthenticated.

---

*Report produced for AppSec pipeline. Fixes for create-profile and clients/[id]/details implemented in same session.*
