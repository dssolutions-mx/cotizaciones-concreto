# Threat Model — Cotizaciones Concreto

**Date:** 2025-03-17  
**Phase:** Step 7 — Threat Modeling  
**Workspace:** cotizaciones-concreto  
**Inputs:** Architecture (Step 1), Static Review, Dependency Risk, Config Review, API Review, Auth/Authz Deep-Dive  
**ASVS Level:** L2 (Standard)

---

## System Context

Cotizaciones Concreto is a **Next.js 16 B2B SaaS** for concrete quoting, orders, client portal, and multi-tenant operations. The system holds **PII**, **financial data** (balances, credit terms), **business data**, and **quality data**. Supabase provides Auth, RLS, and Postgres; ~30+ API routes use `service_role` for admin operations. Roles include ADMIN, EXECUTIVE, PLANT_MANAGER, SALES_AGENT, QUALITY_TEAM, EXTERNAL_CLIENT, etc. Deployment targets Vercel with Supabase as backend. Trust boundaries exist between: anonymous users, authenticated users (per-role scope), internal services (service_role), and external callers (webhooks). **create-profile** and **clients/[id]/details** were fixed in prior sessions; threat scenarios reflect residual and related risks.

---

## Asset Register

| Asset | Confidentiality | Integrity | Availability | Classification |
|-------|-----------------|-----------|--------------|----------------|
| User credentials (passwords, OAuth tokens) | Critical | Critical | High | Most sensitive |
| Session tokens / JWTs | Critical | Critical | High | Critical |
| Supabase `service_role` key | Critical | Critical | High | Critical — bypasses RLS |
| User PII (name, email, phone, address) | High | High | Medium | Sensitive |
| Client financial data (balances, payments, credit terms) | Critical | Critical | High | Regulated |
| Client order history, pricing, delivery data | High | High | High | Business |
| Construction site / project data | High | High | High | Business |
| Quality data (ensayos, muestreos, recipes) | Medium–High | High | High | Business |
| User roles and profiles | Critical | Critical | High | Access control |
| Third-party API keys (geocode, Arkik, etc.) | Critical | Critical | High | Critical |
| Application availability | N/A | N/A | Critical | Business continuity |

---

## Actor Register

| Actor | Trust Level | Access | Potential Motivation |
|-------|-------------|--------|----------------------|
| Anonymous visitor | None | Public endpoints (health, auth callback) | Reconnaissance, credential stuffing, DoS |
| New sign-up (unverified) | Low | create-profile, auth flows | Privilege escalation, account abuse |
| Authenticated user (SALES_AGENT, etc.) | Low–Medium | Own data, role-scoped APIs | IDOR, horizontal privilege escalation |
| EXTERNAL_CLIENT (portal user) | Medium | Client-portal scoped via client_portal_users | Access other clients, data exfiltration |
| EXECUTIVE / ADMIN_OPERATIONS | High | Admin APIs, governance, user management | Insider threat, abuse of approval scope |
| PLANT_MANAGER, QUALITY_TEAM | Medium | Plant/quality scoped data | Cross-plant access, data tampering |
| Application service (service_role) | Medium | Internal APIs, full DB access | Compromised service → full breach |
| Edge Function caller (webhook) | Low | Token-based action endpoints | Token forgery, replay |
| CI/CD / build pipeline | Medium | Deployment, secrets | Supply-chain, secrets exfiltration |
| Malicious npm package | None | Build-time, runtime | Code execution, backdoor |

---

## Entry Points and Data Flows (Summary)

| Entry Point | Auth | Scope | Validation | Rate Limit |
|-------------|------|-------|-------------|------------|
| POST /api/auth/create-profile | Cookie (was manual; now getUser) | user_profiles | Partial | No |
| GET /api/clients/[id]/details | None → **Fixed: getUser** | clients, orders, payments | Path param | No |
| POST /api/auth/reset-password | No | Auth | — | No |
| GET /api/auth/debug | Yes | — | — | No |
| GET /api/clients/list-enriched | Yes | All clients (service_role) | — | No |
| GET /api/credit-terms/[clientId] | Yes | Any clientId | — | No |
| POST /api/clients/pricing | Yes | Any clientIds | — | No |
| PUT /api/materials/[id] | Yes | materials | Full body passed | No |
| POST /api/governance/sites/[id]/approve | Yes (role) | Any site | — | No |
| Token-based (quote/credit/governance actions) | JWT token | Various | Token verify | No |
| All API routes | Mixed | Mixed | Limited Zod | No |

---

## Threat Scenarios

### THREAT-001: Privilege Escalation via Client-Supplied Role (create-profile)

- **STRIDE Category:** E (Elevation of Privilege), T (Tampering)
- **OWASP Category:** A01 — Broken Access Control
- **Actor:** New sign-up (unverified)
- **Entry Point:** `POST /api/auth/create-profile`
- **Asset Targeted:** User roles and profiles, admin access
- **Scenario:** A newly signed-up user sends `{ role: 'ADMIN' }` or `{ role: 'EXECUTIVE' }` when creating their profile. If the server accepts client-supplied role without restriction, the user escalates to admin privileges and gains full system access.
- **Likelihood:** Medium (requires sign-up flow; fixed if server rejects role)
- **Impact:** High (full admin compromise)
- **Risk Score:** 6/9 → High
- **Current Mitigations:** Fix implemented: role derived from user_metadata (invite) or default SALES_AGENT; client-supplied role rejected.
- **Recommended Controls:** ASVS V4.1.3 (deny-by-default), V4.3 (role from trusted source)
- **Related Findings:** STATIC-003, API-002; **Fixed**

---

### THREAT-002: Session Forgery via Manual Cookie Parsing (create-profile)

- **STRIDE Category:** S (Spoofing), I (Information Disclosure)
- **OWASP Category:** A07 — Identification and Authentication Failures
- **Actor:** Attacker with cookie access or XSS
- **Entry Point:** `POST /api/auth/create-profile`
- **Asset Targeted:** User identity, session tokens
- **Scenario:** The route previously extracted user ID/email from manually parsed cookies without JWT verification. An attacker could forge or tamper cookies to impersonate another user when creating/updating profiles.
- **Likelihood:** Low (requires cookie tampering; fixed if using getUser())
- **Impact:** High (identity spoofing, account takeover)
- **Risk Score:** 4/9 → High (residual)
- **Current Mitigations:** Fix implemented: `getUser()` used for authoritative identity verification.
- **Recommended Controls:** ASVS V2.1.1 (verify identity server-side)
- **Related Findings:** STATIC-002, API-003; **Fixed**

---

### THREAT-003: Unauthenticated Access to Client Financial Data (clients/details)

- **STRIDE Category:** I (Information Disclosure), E (Elevation)
- **OWASP Category:** A01 — Broken Access Control, A07 — Broken Authentication
- **Actor:** Anonymous attacker
- **Entry Point:** `GET /api/clients/[id]/details`
- **Asset Targeted:** Client financial data (orders, payments, balances)
- **Scenario:** An unauthenticated attacker enumerates client UUIDs and calls `GET /api/clients/{uuid}/details`, receiving total delivered concrete, payment history, average order size, and related financial data for any client.
- **Likelihood:** High (trivial to exploit)
- **Impact:** High (full financial data breach)
- **Risk Score:** 9/9 → Critical (pre-fix)
- **Current Mitigations:** Fix implemented: `getUser()` check; 401 if unauthenticated.
- **Recommended Controls:** ASVS V4.1.1, V4.2 (auth + object-level auth)
- **Related Findings:** API-001, AUTH; **Fixed**

---

### THREAT-004: Horizontal Privilege Escalation via BOLA (credit-terms, clients/pricing)

- **STRIDE Category:** E (Elevation), I (Information Disclosure)
- **OWASP Category:** A01 — Broken Access Control (BOLA)
- **Actor:** Authenticated user (e.g., EXTERNAL_CLIENT, SALES_AGENT)
- **Entry Point:** `GET /api/credit-terms/[clientId]`, `POST /api/clients/pricing`, `GET /api/clients/list-enriched`
- **Asset Targeted:** Client financial data, credit terms, pricing, client list
- **Scenario:** An EXTERNAL_CLIENT or low-privilege user calls `GET /api/credit-terms/{other-client-uuid}` or `POST /api/clients/pricing` with arbitrary clientIds, or `GET /api/clients/list-enriched` to retrieve data belonging to other clients or the full client list.
- **Likelihood:** Medium (requires auth; UUIDs enumerable)
- **Impact:** High (financial data exfiltration)
- **Risk Score:** 6/9 → High
- **Current Mitigations:** Partial: some routes use RLS; list-enriched and credit-terms lack role/object checks.
- **Recommended Controls:** ASVS V4.1.1, V4.2 (object-level auth per request)
- **Related Findings:** API-005, API-006, API-007, STATIC-005

---

### THREAT-005: Mass Assignment on Materials (Data Tampering)

- **STRIDE Category:** T (Tampering)
- **OWASP Category:** A01 — Broken Access Control (Property-level), A08 — Software and Data Integrity
- **Actor:** Authenticated user with materials write access
- **Entry Point:** `PUT /api/materials/[id]`
- **Asset Targeted:** Materials data, business logic
- **Scenario:** The route passes `body` directly to `.update(body)`. An attacker includes extra fields (e.g., `id`, `created_at`, internal flags) or overwrites fields to bypass business rules or corrupt data.
- **Likelihood:** Medium (requires materials write role)
- **Impact:** Medium (data corruption, logic bypass)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** None (full body passed)
- **Recommended Controls:** ASVS V5.1.3 (allowlist input fields)
- **Related Findings:** API-008

---

### THREAT-006: Governance Approve/Reject Outside Scope (BOLA)

- **STRIDE Category:** E (Elevation), T (Tampering)
- **OWASP Category:** A01 — Broken Access Control
- **Actor:** EXECUTIVE, PLANT_MANAGER, CREDIT_VALIDATOR
- **Entry Point:** `POST /api/governance/sites/[id]/approve`, `.../reject`, `.../clients/[id]/approve`, `.../reject`
- **Asset Targeted:** Construction sites, clients (approval state)
- **Scenario:** Role check exists but no object-level scope. An executive with narrow scope (e.g., one region) approves clients/sites outside their scope by guessing UUIDs.
- **Likelihood:** Medium (requires privileged role)
- **Impact:** Medium (improper approvals, policy bypass)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** Role check only; no plant/region/assignment check.
- **Recommended Controls:** ASVS V4.2 (object-level auth)
- **Related Findings:** API-009

---

### THREAT-007: Session Forgery via getSession() (Server-Side Auth Bypass)

- **STRIDE Category:** S (Spoofing)
- **OWASP Category:** A07 — Identification and Authentication Failures
- **Actor:** Attacker with forged/tampered token
- **Entry Point:** Services using getSession(): qualityEnsayoService, quotes, orderService; MaterialTechnicalSheetManager, MaterialSafetySheetManager
- **Asset Targeted:** User identity, quality data, orders, quotes
- **Scenario:** Server-side code uses `getSession()` which does not revalidate against the auth server. A forged or stale session can be used to impersonate a user; server trusts the token without verification.
- **Likelihood:** Medium (requires token tampering or client manipulation)
- **Impact:** High (identity spoofing, data access)
- **Risk Score:** 6/9 → High
- **Current Mitigations:** Some routes use getUser(); services/components still use getSession().
- **Recommended Controls:** ASVS V2.1.4 (getUser for server-side)
- **Related Findings:** STATIC-001

---

### THREAT-008: Debug Route Exposes Cookie Metadata

- **STRIDE Category:** I (Information Disclosure)
- **OWASP Category:** A05 — Security Misconfiguration
- **Actor:** Authenticated user (or attacker with session)
- **Entry Point:** `GET /api/auth/debug`, `GET /api/auth/test-admin`
- **Asset Targeted:** Session cookie content, debug info
- **Scenario:** Debug route returns cookie header substring or other metadata. test-admin returns cookie content. This aids session hijacking or token theft if exposed.
- **Likelihood:** Medium (requires auth; prod may 404)
- **Impact:** Medium (information disclosure, recon)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** test-admin 404 in prod; debug route auth required.
- **Recommended Controls:** ASVS V7.4.1 (no sensitive data in responses)
- **Related Findings:** API-004, CONFIG (debug route)

---

### THREAT-011: JWT_SECRET Fallback to Service Role Key

- **STRIDE Category:** S (Spoofing), I (Information Disclosure)
- **OWASP Category:** A02 — Cryptographic Failures, API8 — Security Misconfiguration
- **Actor:** Attacker with service key or token-forgery capability
- **Entry Point:** quote-actions/process, credit-actions/process, governance-actions/process
- **Asset Targeted:** Action tokens, service role key
- **Scenario:** If `JWT_SECRET` falls back to service role key, compromise of that key affects both DB access and JWT verification. Token forgery becomes possible; single key does double duty.
- **Likelihood:** Low (requires key compromise or env misconfiguration)
- **Impact:** High (full token forgery, DB access)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** None (fallback exists)
- **Recommended Controls:** ASVS V6.2.1 (dedicated secrets)
- **Related Findings:** STATIC-008, API-014

---

### THREAT-012: Error Details Leakage (Reconnaissance)

- **STRIDE Category:** I (Information Disclosure)
- **OWASP Category:** A09 — Security Logging and Monitoring Failures
- **Actor:** Authenticated or unauthenticated attacker
- **Entry Point:** Multiple API routes returning error.message, error.hint, details
- **Asset Targeted:** Schema, constraints, internal logic
- **Scenario:** API responses include Supabase error messages, hints, and internal details. Attackers learn schema structure, constraint names, and logic to refine attacks.
- **Likelihood:** High (trivial to trigger errors)
- **Impact:** Low–Medium (recon, attack refinement)
- **Risk Score:** 4/9 → High (cumulative)
- **Current Mitigations:** None (errors returned as-is)
- **Recommended Controls:** ASVS V7.4.1 (generic client messages)
- **Related Findings:** STATIC-010, API-013

---

### THREAT-014: Orders Ownership / BOLA (additional-products)

- **STRIDE Category:** E (Elevation), T (Tampering)
- **OWASP Category:** A01 — Broken Access Control
- **Actor:** Authenticated internal user
- **Entry Point:** `GET/POST/PUT/DELETE /api/orders/[id]/additional-products`
- **Asset Targeted:** Order data, additional products
- **Scenario:** Auth present but no explicit order ownership or BOLA check. If RLS is incomplete, a user could modify another user's order additional products.
- **Likelihood:** Medium (depends on RLS/service implementation)
- **Impact:** Medium (order tampering)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** Auth only; RLS may filter.
- **Recommended Controls:** ASVS V4.2 (explicit object-level auth)
- **Related Findings:** API-010

---

### THREAT-015: Limited Input Validation (Injection, DoS)

- **STRIDE Category:** T (Tampering), D (Denial of Service)
- **OWASP Category:** A03 — Injection
- **Actor:** Authenticated or unauthenticated attacker
- **Entry Point:** All API routes accepting JSON, formData, query params
- **Asset Targeted:** Database, application logic
- **Scenario:** Many routes parse `request.json()` or `searchParams` without Zod or schema validation. Malformed input, unbounded strings, or injection payloads may cause runtime errors, bypass validation, or enable injection.
- **Likelihood:** Medium (varies by route)
- **Impact:** Medium (injection, DoS, logic bypass)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** Some routes use Zod; most do not.
- **Recommended Controls:** ASVS V5.1.3 (schema validation)
- **Related Findings:** STATIC-006, STATIC-007

---

### THREAT-016: XSS and Missing CSP

- **STRIDE Category:** T (Tampering), I (Information Disclosure)
- **OWASP Category:** A03 — Injection
- **Actor:** Attacker with XSS or malicious content
- **Entry Point:** Client-side (innerHTML, user-generated content), CSP not enforced
- **Asset Targeted:** User sessions, PII in browser
- **Scenario:** innerHTML usage (LocationSearchBox) and no CSP allow XSS if user input reaches DOM. localStorage auth persistence increases impact. XSS could steal session or profile data.
- **Likelihood:** Low (requires XSS vector)
- **Impact:** High (session theft if tokens reach client)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** Tokens excluded from localStorage persist; React escaping helps.
- **Recommended Controls:** ASVS V5.4.3, V5.4.4 (output encoding, CSP)
- **Related Findings:** STATIC-012, STATIC-013, STATIC-014, CONFIG (CSP unsafe-inline)

---

### THREAT-017: Deprecated auth-helpers and Supply Chain

- **STRIDE Category:** T (Tampering), I (Information Disclosure)
- **OWASP Category:** A06 — Vulnerable Components
- **Actor:** Supply-chain attacker, future CVE
- **Entry Point:** @supabase/auth-helpers-nextjs (deprecated), postinstall scripts
- **Asset Targeted:** Auth flows, build pipeline
- **Scenario:** Deprecated auth-helpers may have unpatched vulnerabilities. Postinstall scripts execute during npm install; malicious package could compromise build or runtime.
- **Likelihood:** Low (0 CVEs now; future risk)
- **Impact:** High (auth bypass, backdoor)
- **Risk Score:** 4/9 → High
- **Current Mitigations:** Migrate to @supabase/ssr; review postinstall.
- **Recommended Controls:** ASVS V14 (secure dependencies)
- **Related Findings:** Dependency (deprecated auth-helpers)

---

### THREAT-018: Debug/Test Endpoints in Production

- **STRIDE Category:** I (Information Disclosure)
- **OWASP Category:** A05 — Security Misconfiguration
- **Actor:** Attacker, misconfigured deployment
- **Entry Point:** /api/debug/duplicate-prices, /api/test-metrics-all, /api/diagnostics/image, /api/example-botid
- **Asset Targeted:** Internal data, test behavior
- **Scenario:** If NODE_ENV misconfigured or routes left enabled, debug and test endpoints expose internal data or test behavior.
- **Likelihood:** Low (prod typically 404s)
- **Impact:** Medium (info disclosure)
- **Risk Score:** 2/9 → Medium
- **Current Mitigations:** Some routes 404 in prod.
- **Recommended Controls:** ASVS V7.4 (no debug in prod)
- **Related Findings:** API-015, API-017, CONFIG (debug routes)

---

## Risk Register Summary

| ID | Title | STRIDE | OWASP | Risk | Priority |
|----|-------|--------|-------|------|----------|
| THREAT-001 | Privilege escalation via client role | E, T | A01 | High (6) | P1 — Fixed |
| THREAT-002 | Session forgery via cookie parsing | S, I | A07 | High (4) | P1 — Fixed |
| THREAT-003 | Unauthenticated clients/details | I, E | A01, A07 | Critical (9) | P1 — Fixed |
| THREAT-004 | BOLA on credit-terms, pricing, list-enriched | E, I | A01 | High (6) | P1 |
| THREAT-005 | Mass assignment on materials | T | A01, A08 | High (4) | P1 |
| THREAT-006 | Governance approve outside scope | E, T | A01 | High (4) | P1 |
| THREAT-007 | getSession() auth bypass | S | A07 | High (6) | P1 |
| THREAT-008 | Debug route cookie metadata | I | A05 | High (4) | P2 |
| THREAT-011 | JWT fallback to service key | S, I | A02 | High (4) | P2 |
| THREAT-012 | Error details leakage | I | A09 | High (4) | P2 |
| THREAT-014 | Orders additional-products BOLA | E, T | A01 | High (4) | P2 |
| THREAT-015 | Limited input validation | T, D | A03 | High (4) | P2 |
| THREAT-016 | XSS and missing CSP | T, I | A03 | High (4) | P2 |
| THREAT-017 | Deprecated auth-helpers, supply chain | T, I | A06 | High (4) | P2 |
| THREAT-018 | Debug/test endpoints prod | I | A05 | Medium (2) | P3 |

---

## Top 5 Risks Requiring Immediate Attention

1. **THREAT-004: BOLA on credit-terms, clients/pricing, list-enriched**  
   - **Risk:** High (6/9)  
   - **Action:** Add role checks and object-level authorization to `GET /api/credit-terms/[clientId]`, `POST /api/clients/pricing`, and `GET /api/clients/list-enriched`. Verify user has access to requested clientId(s) before returning data.

2. **THREAT-007: getSession() Server-Side Auth Bypass**  
   - **Risk:** High (6/9)  
   - **Action:** Replace all server-side `getSession()` calls with `getUser()` in qualityEnsayoService, quotes, orderService, MaterialTechnicalSheetManager, MaterialSafetySheetManager.

3. **THREAT-008: Debug Route Exposes Cookie Metadata**  
   - **Risk:** High (4/9)  
   - **Action:** Remove or restrict `GET /api/auth/debug`; never return cookie content or debug data to clients in any environment.

4. **THREAT-005: Mass Assignment on Materials**  
   - **Risk:** High (4/9)  
   - **Action:** Allowlist fields in `PUT /api/materials/[id]`; pass only permitted fields to `.update()` instead of full body.

5. **THREAT-012: Error Details Leakage**  
   - **Risk:** High (4/9)  
   - **Action:** Return generic error messages to clients; log full Supabase errors (message, hint, details) server-side only.

---

## Control Mapping (ASVS)

| ASVS Section | Control | Threat Coverage |
|--------------|---------|-----------------|
| V2 Authentication | getUser() server-side; strong password; MFA for admin | THREAT-001, 002, 003, 007 |
| V3 Session Management | HttpOnly cookies; secure token storage | THREAT-002, 016 |
| V4 Access Control | RLS least privilege; object-level auth per request; deny-by-default | THREAT-001, 003, 004, 006, 014 |
| V5 Input Validation | Zod schema; allowlist fields; output encoding | THREAT-005, 015, 016 |
| V6 Cryptography | Dedicated JWT secret; no fallback | THREAT-011 |
| V7 Error Handling | Generic client messages; no debug in prod | THREAT-008, 012, 018 |
| V14 Dependencies | Migrate auth-helpers; audit postinstall | THREAT-017 |
| NIST AU | Rate limiting | Handled (Vercel) |

---

*Report produced for the AppSec pipeline report writer. Threat scenarios map to OWASP Top 10, STRIDE, and ASVS L2 controls.*
