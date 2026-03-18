# API Security Review — Cotizaciones Concreto

**Date:** 2025-03-17  
**Phase:** Step 5 — API Security Review (OWASP API Security Top 10)  
**Architecture Context:** Next.js 16 App Router, Supabase Auth + @supabase/ssr, multi-tenant, RBAC  
**Inputs:** docs/STATIC_SECURITY_REVIEW.md, API route inventory

---

## API Inventory

| Endpoint / Route | Method(s) | Auth Required | Resource | Input Params | Notes |
|------------------|-----------|---------------|----------|--------------|-------|
| /api/health | GET | No (public) | Status | — | Health check |
| /api/auth/create-profile | POST | Yes (getUser) | user_profiles | firstName, lastName | **Fixed** — now uses getUser(); role derived server-side |
| /api/auth/create-user | POST | Yes (getUser) | auth.users | body | Admin-only |
| /api/auth/invite-user | POST | Yes (getUser + role) | auth.users | email, role, callerId, callerEmail | EXECUTIVE/ADMIN_OPERATIONS |
| /api/auth/verify-invitation | GET | No (token in URL) | invitation_tokens | token (query) | Token-based flow |
| /api/auth/update-password | POST | Yes | auth | body | |
| /api/auth/reset-password | POST | No | auth | body | |
| /api/auth/check-session | GET | Yes | auth | — | |
| /api/auth/test-admin | GET | getSession (deprecated) | user_profiles | — | Dev only, 404 prod |
| /api/auth/debug | GET | Yes | — | — | Debug |
| /api/user/profile | GET | Yes | user_profiles | — | |
| /api/clients/[id]/details | GET | Yes (getUser) | clients, orders, payments | id (path) | **Fixed** — now requires auth |
| /api/clients/delivery-dates | GET | Yes | remisiones | — | |
| /api/clients/list-enriched | GET | Yes | clients, balances | — | Service role, no role check |
| /api/clients/pricing | POST | Yes | product_prices | clientIds | No client access check |
| /api/clients/payment-dates | POST | Yes | — | body | |
| /api/clients/check-duplicates | GET | Yes | clients | query | |
| /api/credit-terms/[clientId] | GET, POST, DELETE | Yes | credit_terms | clientId (path) | GET no role check; BOLA |
| /api/credit-terms/status/[clientId] | GET | Yes | credit_terms | clientId (path) | BOLA possible |
| /api/credit-terms/status/batch | POST | Yes | — | body | |
| /api/credit-terms/pending | GET | Yes | — | — | |
| /api/credit-terms/approve/[termsId] | POST | Yes | credit_terms | termsId | BOLA possible |
| /api/credit-terms/documents/upload | POST | Yes | — | formData | |
| /api/credit-terms/documents/status/status | PATCH | Yes | — | body | |
| /api/credit-documents/[clientId] | GET | Yes | — | clientId | BOLA possible |
| /api/finanzas/client-payments | GET, POST | Yes (role) | client_payments | body | |
| /api/finanzas/client-payments/[id] | PATCH, DELETE | Yes (role) | client_payments | id (path) | RPC ownership |
| /api/finanzas/balances-export | GET | Yes | — | — | |
| /api/finanzas/balances-export/[clientId] | GET | Yes | — | clientId | BOLA possible |
| /api/finanzas/supplier-analysis | GET | Yes | — | query | |
| /api/governance/pending | GET | Yes (role) | clients, construction_sites | — | |
| /api/governance/sites/[id]/approve | POST | Yes (role) | construction_sites | id (path) | No BOLA: any exec can approve any site |
| /api/governance/sites/[id]/reject | POST | Yes (role) | construction_sites | id (path) | Same |
| /api/governance/clients/[id]/approve | POST | Yes (role) | clients | id (path) | Same |
| /api/governance/clients/[id]/reject | POST | Yes (role) | clients | id (path) | Same |
| /api/governance-actions/process | GET | JWT token | quote_action_tokens | token (query) | Token-based |
| /api/governance-actions/direct-action | GET | JWT token | — | — | |
| /api/quote-actions/process | GET | JWT token | quote_action_tokens | token (query) | Token-based |
| /api/quote-actions/direct-action | GET | JWT token | — | — | |
| /api/credit-actions/process | GET | JWT token | credit_actions | token | Token-based |
| /api/credit-actions/direct-action | GET | JWT token | — | — | |
| /api/admin/client-portal-users | GET, POST | Yes (EXECUTIVE/ADMIN_OPERATIONS) | user_profiles, client_portal_users | body | |
| /api/admin/client-portal-users/[userId] | GET, PATCH, DELETE | Yes (role) | client_portal_users | userId | Admin scope |
| /api/admin/client-portal-users/[userId]/clients | POST, DELETE, PATCH | Yes (role) | client_portal_users | userId | Admin scope |
| /api/admin/recipes-without-materials | GET | Yes (role) | recipes | — | |
| /api/admin/pumping-remisiones | GET | Yes | remisiones | — | |
| /api/client-portal/orders | GET, POST | Yes (RLS) | orders | body | RLS filters |
| /api/client-portal/orders/[id] | GET | Yes (RLS) | orders | id | RLS filters |
| /api/client-portal/orders/[id]/approve | POST | Yes (executive for client) | orders | id | BOLA checked |
| /api/client-portal/orders/[id]/reject | POST | Yes (executive) | orders | id | BOLA checked |
| /api/client-portal/orders/pending-approval | GET | Yes | orders | — | |
| /api/client-portal/balance | GET | Yes | — | — | |
| /api/client-portal/team | GET, POST | Yes | client_portal_users | body | |
| /api/client-portal/team/[userId] | PATCH, DELETE | Yes (executive) | client_portal_users | userId | BOLA checked (same client) |
| /api/client-portal/team/[userId]/permissions | PATCH | Yes | client_portal_users | userId | |
| /api/client-portal/sites | GET | Yes | construction_sites | — | |
| /api/client-portal/quality | GET | Yes | — | — | |
| /api/client-portal/quality/dossier | GET | Yes | — | — | |
| /api/client-portal/master-recipes | GET | Yes | master_recipes | — | |
| /api/client-portal/dashboard | GET | Yes | — | — | |
| /api/client-portal/me/role-and-permissions | GET | Yes | — | — | |
| /api/client-portal/metrics | GET | Yes | — | — | |
| /api/orders/[id]/additional-products | GET, POST, PUT, DELETE | Yes | order_additional_products | id, quote_id, product_id, quantity | Auth only; no role/BOLA |
| /api/orders/[id]/order-totals | GET | Yes | orders | id | |
| /api/orders/[id]/quality-compliance | GET | Yes | — | id | |
| /api/orders/[id]/pumping-evidence | GET | Yes | — | id | |
| /api/orders/[id]/sampling-info | GET | Yes | — | id | |
| /api/orders/nearby-deliveries | GET | Yes | orders | query | |
| /api/po/[id] | GET, PUT | Yes (role) | purchase_orders | id | PLANT_MANAGER scoped for GET |
| /api/po/[id]/items | GET, POST | Yes | purchase_order_items | id | |
| /api/po/[id]/summary | GET | Yes | — | id | |
| /api/po/[id]/related-payables | GET | Yes | — | id | |
| /api/po/items/[itemId] | PUT, DELETE | Yes | purchase_order_items | itemId | |
| /api/po/items/[itemId]/credit | POST, GET | Yes | — | itemId | |
| /api/po/items/search | GET | Yes | — | query | |
| /api/po | GET, POST | Yes | purchase_orders | body | |
| /api/ap/payables | GET | Yes | payables | query | |
| /api/ap/payables/[id]/validate | GET | Yes | — | id | |
| /api/ap/payments | GET, POST | Yes | — | body | |
| /api/price-governance | GET | Yes (role) | construction_sites, product_prices | query | |
| /api/price-governance/sites/[siteId] | PATCH | Yes | construction_sites | siteId | |
| /api/price-governance/prices/[priceId] | PATCH | Yes | product_prices | priceId | |
| /api/price-governance/bulk-deactivate | POST | Yes | — | body | |
| /api/price-governance/bulk-deactivate/preview | GET | Yes | — | — | |
| /api/quotes/approve | POST | Yes | quotes | body | |
| /api/quotes/notify-approval | POST | Yes | — | body | |
| /api/quotes/calculate-distance | POST | Yes | — | body | |
| /api/quotes/fix-product-prices | POST, GET | Yes | — | body | |
| /api/quotes/[quoteId]/additional-products | GET, POST, PUT, DELETE | Yes | quote_additional_products | quoteId | |
| /api/materials | GET, POST | Yes | materials | body | |
| /api/materials/[id] | PUT, DELETE | Yes (role) | materials | id | **Mass assignment** (.update(body)) |
| /api/materials/safety-sheets | POST, GET, DELETE | Yes | — | formData | |
| /api/materials/technical-sheets | POST, GET, DELETE | Yes | — | formData | |
| /api/materials/certificates | POST, GET, DELETE | Yes | — | formData | |
| /api/inventory | GET, POST | Yes | inventory | body | |
| /api/inventory/entries | GET, POST, PUT | Yes | inventory_entries | body | |
| /api/inventory/adjustments | GET, POST, PUT | Yes | — | body | |
| /api/inventory/daily-log | GET, POST, PUT | Yes | — | body | |
| /api/inventory/dashboard | GET, POST | Yes | — | body | |
| /api/inventory/documents | POST, GET, DELETE | Yes | — | formData | |
| /api/inventory/activity | GET | Yes | — | query | |
| /api/inventory/arkik-upload | POST | Yes | — | formData | |
| /api/remisiones/[id]/confirm | POST | Yes | remisiones | id | |
| /api/remisiones/[id]/allocate-fifo | POST, GET | Yes | remisiones | id | |
| /api/remisiones/documents | POST, GET, DELETE | Yes | — | body | |
| /api/quality/ensayos | POST | Yes | ensayos | body | |
| /api/quality/evidencias | POST | Yes | — | formData | |
| /api/quality/muestras/[id] | DELETE | Yes | muestras | id | |
| /api/quality/muestreos/[id] | DELETE, PUT | Yes | muestreos | id | |
| /api/plants | GET | Yes | plants | — | |
| /api/plants/certificates | POST, GET, DELETE | Yes | — | formData | |
| /api/plants/verifications | GET, POST, DELETE | Yes | — | body | |
| /api/plants/dossier | POST, GET, DELETE | Yes | — | body | |
| /api/dashboard | GET | Yes | — | query | |
| /api/dashboard/quotes | GET | Yes | — | — | |
| /api/dashboard/orders/pending | GET | Yes | — | — | |
| /api/dashboard/orders/validation-count | GET | Yes | — | — | |
| /api/dashboard/sales | GET | Yes | — | — | |
| /api/dashboard/recipes | GET | Yes | — | — | |
| /api/dashboard/activity | GET | Yes | — | — | |
| /api/additional-products | GET, POST, PUT | Yes | additional_products | body | |
| /api/distance-ranges | GET, POST | Yes | — | body | |
| /api/suppliers | GET, POST | Yes | suppliers | body | |
| /api/geocode/reverse | POST | Yes | — | lat, lng | No SSRF (coords only) |
| /api/geocode/backfill | POST, GET | Yes (role) | orders | batch_size | Rate limit internal |
| /api/google-maps/distance-matrix | POST | Yes | — | origins, destinations | No SSRF |
| /api/arkik/validate | POST | Yes | — | body | |
| /api/arkik/process | POST | Yes | — | body | |
| /api/arkik/sessions | GET | Yes | — | — | |
| /api/recipes/export/arkik | GET | Yes | recipes | query | |
| /api/attendance/logs | POST, GET, DELETE | Yes | attendance | body | |
| /api/release-announcement/status | GET | Yes | release_announcement_views | — | |
| /api/release-announcement/viewed | POST | Yes | — | body | |
| /api/diagnostics/image | GET | No | — | — | Fetches same-origin image |
| /api/debug/duplicate-prices | GET | Yes (admin), 404 prod | quotes | query | Dev only |
| /api/test-metrics-all | GET | Yes | — | — | |
| /api/example-botid | POST | Yes (BotID) | — | body | |

---

## Findings

### API-001: clients/[id]/details — No Authentication (Critical)

**Status: FIXED** — Remediated in a prior session; route now requires `getUser()`.

- **Severity:** Critical  
- **OWASP API:** API1 — Broken Object Level Authorization, API2 — Broken Authentication  
- **OWASP Web:** A01, A07  
- **Endpoint(s):** `GET /api/clients/[id]/details`  
- **Evidence (pre-fix):** The route had no authentication check. Now fixed.  
- **Attack Scenario:** An unauthenticated attacker sends `GET /api/clients/{any-client-uuid}/details` and receives financial data (total concrete delivered, payments, average order size, payment history) for any client. Complete data breach of client financials.  
- **Remediation:** Add authentication and authorization:

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// Add role check and/or ensure user has access to this client (e.g., via RLS or explicit check)
```

---

### API-002: create-profile — Client-supplied Role (Privilege Escalation)

**Status: FIXED** — Remediated in a prior session; role now derived server-side.

- **Severity:** Critical  
- **OWASP API:** API5 — Broken Function Level Authorization, API3 — Broken Object Property Level Authorization  
- **OWASP Web:** A01  
- **Endpoint(s):** `POST /api/auth/create-profile`  
- **Evidence (pre-fix):** Route accepted `role` from `request.json()` and passed to upsert. Now fixed.  
- **Attack Scenario:** Newly signed-up user sends `POST /api/auth/create-profile` with `role: 'ADMIN'` or `role: 'EXECUTIVE'` and escalates to admin.  
- **Remediation:** Do not accept `role` from client. Set default `'SALES_AGENT'` server-side. If configurable, restrict to admin-only endpoint with allowlist.

---

### API-003: create-profile — Manual Cookie Parsing, No JWT Verification

**Status: FIXED** — Remediated in a prior session; route now uses `getUser()`.

- **Severity:** High  
- **OWASP API:** API2 — Broken Authentication  
- **OWASP Web:** A07  
- **Endpoint(s):** `POST /api/auth/create-profile`  
- **Evidence (pre-fix):** User ID and email were extracted by manual cookie parsing. Now uses `getUser()`.  
- **Attack Scenario:** Attacker forges or tampers cookie to impersonate another user when creating profile.  
- **Remediation:** Use `createServerSupabaseClient()` and `supabase.auth.getUser()` for identity verification.

---

### API-004: auth/test-admin — getSession() and Debug Info Exposure

- **Severity:** Medium  
- **OWASP API:** API2 — Broken Authentication, API8 — Security Misconfiguration  
- **Endpoint(s):** `GET /api/auth/test-admin`  
- **Evidence:** Uses deprecated `createRouteHandlerClient` and `getSession()`. Returns `debug: { cookieHeader: cookieHeader.substring(0, 100) + '...' }` exposing cookie content.  
- **Attack Scenario:** In development, session forgery and information disclosure. Production returns 404.  
- **Remediation:** Remove or refactor to use `@supabase/ssr` and `getUser()`. Never return cookie content or debug data to clients.

---

### API-005: credit-terms/[clientId] GET — No Role Check, BOLA

- **Severity:** High  
- **OWASP API:** API1 — Broken Object Level Authorization, API5 — Broken Function Level Authorization  
- **Endpoint(s):** `GET /api/credit-terms/[clientId]`  
- **Evidence:** Authenticated user required but no role check. Any authenticated user can request credit terms for any `clientId`.  
- **Attack Scenario:** EXTERNAL_CLIENT user A calls `GET /api/credit-terms/{client-B-uuid}` and reads client B's credit terms.  
- **Remediation:** Add role check or tenant-scoping. Ensure user is authorized to access this client (e.g., via client_portal_users or internal role).

---

### API-006: clients/list-enriched — No Role Check, Excessive Data

- **Severity:** High  
- **OWASP API:** API3 — Excessive Data Exposure, API5 — Broken Function Level Authorization  
- **Endpoint(s):** `GET /api/clients/list-enriched`  
- **Evidence:** Uses `createServiceClient()` (bypasses RLS). Returns all clients with balances and site counts. No role check.  
- **Attack Scenario:** EXTERNAL_CLIENT or low-privilege user calls endpoint and receives full client list with financial summaries.  
- **Remediation:** Add role check (e.g., EXECUTIVE, ADMIN_OPERATIONS, PLANT_MANAGER). Consider RLS or explicit tenant filtering.

---

### API-007: clients/pricing — No Client Access Verification

- **Severity:** Medium  
- **OWASP API:** API1 — Broken Object Level Authorization  
- **Endpoint(s):** `POST /api/clients/pricing`  
- **Evidence:** Accepts `clientIds` array. `ClientPricingService.getBulkClientPricing(clientIds)` returns pricing for provided IDs. No check that user can access those clients.  
- **Attack Scenario:** User passes `clientIds` of clients they do not own to enumerate pricing.  
- **Remediation:** Validate user has access to each clientId (RLS, association table, or role-based scope).

---

### API-008: materials/[id] PUT — Mass Assignment

- **Severity:** High  
- **OWASP API:** API3 — Broken Object Property Level Authorization (Mass Assignment)  
- **Endpoint(s):** `PUT /api/materials/[id]`  
- **Evidence:** `const body = await request.json();` then `.update(body)` — full body spread into update.  
- **Attack Scenario:** Attacker sends `{ material_code, material_name, category, unit_of_measure, is_active: true, id: 'other-id' }` or other fields to bypass business rules or corrupt data.  
- **Remediation:** Allowlist fields: `const { material_code, material_name, category, unit_of_measure, ... } = body;` and only pass those to update.

---

### API-009: governance/sites and clients approve/reject — No Object-Level Scope

- **Severity:** Medium  
- **OWASP API:** API1 — Broken Object Level Authorization  
- **Endpoint(s):**  
  - `POST /api/governance/sites/[id]/approve`  
  - `POST /api/governance/sites/[id]/reject`  
  - `POST /api/governance/clients/[id]/approve`  
  - `POST /api/governance/clients/[id]/reject`  
- **Evidence:** Role check (EXECUTIVE, PLANT_MANAGER, CREDIT_VALIDATOR) but no verification that user is authorized for that specific site/client (e.g., region, plant).  
- **Attack Scenario:** Executive with narrow scope approves clients/sites outside their scope by guessing UUIDs.  
- **Remediation:** Add object-level authorization: verify user's plant_id, region, or explicit assignment before allowing approve/reject.

---

### API-010: orders/[id]/additional-products — Auth Only, No BOLA

- **Severity:** Medium  
- **OWASP API:** API1 — Broken Object Level Authorization  
- **Endpoint(s):** `GET/POST/PUT/DELETE /api/orders/[id]/additional-products`  
- **Evidence:** `getUser()` present but no role check or order ownership/access verification. Service may use client-side Supabase.  
- **Attack Scenario:** Internal user modifies another user's order additional products if RLS is incomplete.  
- **Remediation:** Ensure `getOrderAdditionalProducts` and related services use server client with RLS, or add explicit order access check.

---

### API-011: Rate Limiting (Informational)

- **Severity:** Informational  
- **OWASP API:** API4 — Unrestricted Resource Consumption  
- **Endpoint(s):** All API routes  
- **Evidence:** Vercel provides rate limiting via Vercel Firewall and platform-level protections. No app-level rate limiting middleware.  
- **Attack Scenario:** Mitigated by Vercel infrastructure.  
- **Remediation:** Verify Vercel Firewall rate limits cover auth endpoints and expensive operations. No app-level implementation required unless stricter limits are needed.

---

### API-012: Pagination Limits Not Enforced Consistently

- **Severity:** Low  
- **OWASP API:** API4 — Unrestricted Resource Consumption  
- **Endpoint(s):** Various (clients/list-enriched, inventory, etc.)  
- **Evidence:** Some routes use `.limit(2000)` (delivery-dates); others have no explicit limit.  
- **Attack Scenario:** Large result sets cause memory/CPU spike or slow responses.  
- **Remediation:** Enforce pagination (limit/offset or cursor) with max `limit` (e.g., 100) on list endpoints.

---

### API-013: Error Details in API Responses

- **Severity:** Medium  
- **OWASP API:** API8 — Security Misconfiguration  
- **Endpoint(s):** Multiple (see STATIC_SECURITY_REVIEW FINDING-010)  
- **Evidence:** `profileError.message`, `error.message`, `details: error.message` returned to clients.  
- **Attack Scenario:** Attackers learn schema, constraints, and internal logic from error messages.  
- **Remediation:** Return generic messages to clients; log full errors server-side only.

---

### API-014: JWT_SECRET Fallback to Service Role Key

- **Severity:** Medium  
- **OWASP API:** API2 — Broken Authentication, API8  
- **Endpoint(s):** quote-actions/process, credit-actions/process, governance-actions/process  
- **Evidence:** `JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || supabaseServiceKey`  
- **Attack Scenario:** If service key is used as JWT secret, compromise affects both DB access and token verification.  
- **Remediation:** Require dedicated JWT secret; fail startup if not set.

---

### API-015: Debug and Test Endpoints

- **Severity:** Low (Informational in prod)  
- **OWASP API:** API9 — Improper Inventory Management  
- **Endpoint(s):** `/api/debug/duplicate-prices`, `/api/auth/test-admin`, `/api/test-metrics-all`, `/api/diagnostics/image`, `/api/example-botid`  
- **Evidence:** debug/duplicate-prices and test-admin return 404 in production. test-metrics-all and diagnostics/image have no NODE_ENV guard.  
- **Attack Scenario:** If NODE_ENV misconfigured or routes left enabled, debug data and test behavior exposed.  
- **Remediation:** Ensure all debug/test routes return 404 in production. Consider removing or gating behind feature flags.

---

### API-016: Webhook Signature Verification (Future)

- **Severity:** Informational  
- **OWASP API:** API10 — Unsafe Consumption of APIs  
- **Endpoint(s):** N/A — no incoming external webhooks in scope  
- **Evidence:** Outbound webhooks (DB → Edge Functions) exist. No Stripe/GitHub-style inbound webhooks found.  
- **Remediation:** For any future external webhooks, implement signature verification (e.g., Stripe `constructEvent`) before processing.

---

### API-017: diagnostics/image — Unauthenticated

- **Severity:** Low  
- **OWASP API:** API2 — Broken Authentication  
- **Endpoint(s):** `GET /api/diagnostics/image`  
- **Evidence:** No auth check. Fetches same-origin `/images/dcconcretos/hero1.jpg` via HEAD.  
- **Attack Scenario:** Minor; only exposes image metadata. Could be used for reconnaissance.  
- **Remediation:** Add authentication or remove if not needed in production.

---

## API Security Summary

Three Critical findings (API-001, API-002, API-003) were fixed in a prior session: create-profile now uses getUser() and derives role server-side; clients/details now requires auth.

| Check | Status | Findings |
|-------|--------|----------|
| Object-level authorization | ❌ | API-001 (Fixed), API-005, API-007, API-009, API-010 |
| Function-level authorization | ❌ | API-002 (Fixed), API-004, API-005, API-006 |
| Authentication (getUser vs getSession) | ❌ | API-001 (Fixed), API-003 (Fixed), API-004 |
| Excessive data exposure | ❌ | API-006 |
| Mass assignment protection | ❌ | API-002 (Fixed), API-008 |
| Rate limiting | ✅ Handled (Vercel) | API-011 (Informational) |
| Pagination limits | ⚠️ | API-012 (inconsistent) |
| Input validation (Zod) | ⚠️ | Limited across routes (see STATIC) |
| Error response sanitization | ❌ | API-013 |
| CORS configuration | ✅ | Next.js defaults |
| Debug/test endpoint hygiene | ⚠️ | API-015 |
| Webhook signature verification | N/A | API-016 (no external webhooks) |
| SSRF (URL input) | ✅ | No user-provided URLs to fetch |
| JWT / crypto config | ❌ | API-014 |

---

## Priority Remediation Order

1. ~~**API-001**~~ — FIXED: clients/[id]/details now requires auth.
2. ~~**API-002**~~ — FIXED: create-profile rejects client-supplied role; derives server-side.
3. ~~**API-003**~~ — FIXED: create-profile uses getUser() instead of manual cookie parsing.
4. **API-006** — Add role check to clients/list-enriched.
5. **API-005** — Add role/access check to credit-terms/[clientId] GET.
6. **API-008** — Allowlist fields in materials/[id] PUT.
7. **API-007** — Validate client access in clients/pricing.
8. **API-013** — Sanitize error responses.
9. **API-014** — Remove JWT_SECRET fallback to service key.

---

*Report produced for use in the threat modeling phase of the AppSec pipeline.*
