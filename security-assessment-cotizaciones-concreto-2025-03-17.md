# Security Assessment Report

| | |
|---|---|
| **Application** | Cotizaciones Concreto |
| **Assessment Date** | 2025-03-17 |
| **Assessed By** | Claude AppSec Suite |
| **ASVS Target Level** | L2 |
| **Overall Risk Rating** | 🟡 Medium |
| **Scope** | Codebase, API routes, configuration, dependencies, RLS policies, auth/authz |
| **Environment** | Development / Staging / Production |

---

## Executive Summary

Cotizaciones Concreto is a **Next.js 16 B2B SaaS** for concrete quoting, orders, quality management, and a multi-tenant client portal. It uses Supabase for authentication, PostgreSQL, and Row Level Security (RLS). The system handles **PII**, **financial data** (client balances, credit terms, payments), and **business data**. This assessment covered static code review, API security, authentication and authorization, configuration, dependencies, and threat modeling.

**Overall security posture:** The application has made progress—several **Critical** vulnerabilities (create-profile privilege escalation, unauthenticated clients/details, manual cookie parsing) were **fixed** in prior sessions. RLS policies on clients, construction_sites, and client_balances were verified via Supabase MCP. Policies are correctly configured: external clients are restricted via external_client_*_read policies; internal roles have appropriate access. No USING(true) on these tables.

**Most critical risk:** BOLA on credit-terms, list-enriched, and pricing is **accepted company policy** — internal workers (SALES_AGENT, EXECUTIVE, etc.) are intended to access all client data for operations. Remaining concerns: `getSession()` usage, limited input validation, and debug route exposure.

**Positive findings:** Supabase Auth is used correctly in most routes; critical auth fixes were implemented; TypeScript provides type safety; dependency audit shows 0 CVEs; the SERVICE_ROLE_KEY is not exposed in client bundles; most API routes enforce `getUser()`; and role-based checks exist for sensitive operations such as create-user and invite-user.

**Recommended immediate action:** (1) Replace `getSession()` with `getUser()` in server-side auth paths. (2) Add input validation (Zod) for the next sprint. Note: BOLA on credit-terms/list-enriched/pricing is company policy (internal access); no change required.

---

## Architecture Overview

**Application:** B2B SaaS web application (quoting, orders, client portal, quality, procurement)

**Stack:** Next.js 16 App Router, TypeScript, Supabase (Auth, PostgreSQL, RLS), Vercel deployment

**Authentication:** Supabase Auth with `@supabase/ssr`; roles stored in `user_profiles`; ~30+ API routes use `service_role` for admin operations

**ASVS Level:** L2 (standard assurance for PII-handling applications)

### Trust Boundaries

- **Anonymous** → Public health/auth callback
- **Authenticated (per-role)** → Role-scoped APIs, client-portal data
- **EXECUTIVE / ADMIN_OPERATIONS** → User management, governance, approvals
- **service_role** → Internal admin APIs, bypasses RLS

### Data Sensitivity

PII (user names, emails, phone), client financial data (balances, credit terms, payments), order history, construction sites, and quality data. Multi-tenant isolation is required.

---

## Top Findings

| # | Severity | OWASP Category | Title | Affected Component |
|---|----------|----------------|-------|-------------------|
| 1 | ⚪ Accepted | A01 | BOLA on credit-terms, list-enriched, pricing (company policy) | API routes |
| 2 | 🟠 High | A01 Broken Access Control | Mass assignment on materials PUT | /api/materials/[id] |
| 3 | 🟠 High | A07 Auth Failures | getSession() used instead of getUser() (FIXED) | Services |
| 4 | 🟠 High | A05 Security Misconfiguration | Debug route exposes cookie metadata | /api/auth/debug |
| 5 | 🟡 Medium | A05 Security Misconfiguration | JWT_SECRET fallback to service key | Action routes |
| 6 | 🟡 Medium | A09 Logging | Error details in API responses | Multiple routes |
| 7 | 🟡 Medium | A03 Injection | Limited input validation (Zod) | API routes |
| — | ✅ Fixed | A01 | create-profile client-supplied role | create-profile |
| — | ✅ Fixed | A07 | create-profile manual cookie parsing | create-profile |
| — | ✅ Fixed | A01/A07 | clients/[id]/details unauthenticated | clients/details |

---

## Detailed Findings

---

### A01 — Broken Access Control

---

#### FINDING-001: BOLA on credit-terms, list-enriched, pricing — **Accepted (Company Policy)**

**Severity:** Informational  
**OWASP:** A01 — Broken Object Level Authorization  
**Component:** `GET /api/credit-terms/[clientId]`, `GET /api/clients/list-enriched`, `POST /api/clients/pricing`

#### Description

These endpoints require authentication. Internal workers (SALES_AGENT, EXECUTIVE, PLANT_MANAGER, etc.) are intended to access all client data per company policy for B2B operations. RLS and role checks on EXTERNAL_CLIENT scope client-portal data separately.

#### Status

**Accepted design** — No remediation required.

---

#### FINDING-002: Mass assignment on materials PUT

**Severity:** High  
**OWASP:** A01 — Broken Object Property Level Authorization (Mass Assignment)  
**Component:** `PUT /api/materials/[id]`

#### Description

Mass assignment occurs when an API accepts arbitrary request body fields and writes them directly to the database. The materials PUT route used `.update(body)`, so a client could send extra fields (e.g. `{ material_code: 'X', created_at: '2020-01-01', id: 'other-uuid' }`) and potentially overwrite protected columns. The fix is to allowlist only the fields the API intends to update and ignore the rest.

---

### A07 — Identification and Authentication Failures

---

#### FINDING-003: getSession() instead of getUser() (server-side)

**Severity:** High  
**OWASP:** A07 — Identification and Authentication Failures  
**Component:** `qualityEnsayoService.ts`, `quotes.ts`, `orderService.ts`, `MaterialTechnicalSheetManager.tsx`, `MaterialSafetySheetManager.tsx`

#### Description

`getSession()` reads from the client token without revalidating against the auth server; it can be forged. Supabase recommends `getUser()` for server-side identity verification.

#### Remediation

Replace `getSession()` with `getUser()` in all server-side auth decision paths. *Vercel React Best Practices:* Pass user from route to services to avoid redundant `getUser()` calls and minimize waterfalls.

---

### A05 — Security Misconfiguration

---

#### FINDING-004: Debug route exposes cookie metadata

**Severity:** High  
**OWASP:** A05 — Security Misconfiguration  
**Component:** `GET /api/auth/debug`

#### Description

The debug route returns cookie header content to the client, leaking session metadata.

#### Remediation

Remove or refactor: do not return cookie content or debug data to clients; gate behind NODE_ENV and return 404 in production.

---

#### FINDING-005: JWT_SECRET fallback to service role key

**Severity:** Medium  
**OWASP:** A02/A05  
**Component:** `quote-actions/process`, `credit-actions/process`, `governance-actions/process`

#### Description

`JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || supabaseServiceKey`—falling back to the service key mixes concerns.

#### Remediation

Require a dedicated JWT secret; fail startup if not set.

---

### A09 — Security Logging and Monitoring Failures

---

#### FINDING-006: Error details in API responses

**Severity:** Medium  
**OWASP:** A09  
**Component:** Multiple routes (quality/ensayos, quality/evidencias, plants/certificates, create-profile, remisiones, inventory/entries, BalanceAdjustmentModal)

#### Description

Supabase `error.message`, `error.hint`, and internal details are returned to clients.

#### Remediation

Return generic messages to clients; log full errors server-side only.

---

### A03 — Injection

---

#### FINDING-007: Limited input validation

**Severity:** Medium  
**OWASP:** A03 — Injection  
**Component:** Many API routes

#### Description

Routes parse `request.json()`, `formData`, or `searchParams` without Zod or schema validation.

#### Remediation

Add Zod validation for all API inputs; enforce max lengths and types.

---

### API4 — Unrestricted Resource Consumption

---

#### Informational: Verify Vercel Firewall rate limits

**Severity:** Informational  
**OWASP:** API4  
**Component:** Auth endpoints

#### Description

Rate limiting is handled by Vercel Firewall. Verify that Vercel Firewall rate limits adequately cover auth endpoints and expensive operations.

---

## Dependency Risk

### Audit Results

- Packages with Critical vulnerabilities: **0**
- Packages with High vulnerabilities: **0**
- Outdated packages: Some
- Deprecated packages: **@supabase/auth-helpers-nextjs** (in use)

### Key Actions

| Package | Issue | Fix |
|---------|-------|-----|
| @supabase/auth-helpers-nextjs | Deprecated | Migrate to @supabase/ssr |

### Supply-Chain Hygiene

Lockfile committed; version pinning in place. Review postinstall scripts for risk. No Critical/High CVEs in current audit.

---

## Configuration & Secrets

| Check | Status | Notes |
|-------|--------|-------|
| .env not committed | ✅ | |
| SERVICE_ROLE_KEY server-only | ✅ | Not exposed in client bundles |
| Security headers configured | ⚠️ | Add CSP, HSTS in next.config |
| Rate limiting on auth endpoints | ✅ | Vercel Firewall |
| CORS appropriately configured | ✅ | Next.js defaults |
| RLS enabled on tables | ✅ | Verified correct via Supabase MCP |
| Email confirmations | ✅ | Enabled |
| Password minimum | ✅ | Min 8 (NIST-compliant) |

---

## Threat Model Summary

### Risk Register (Top 5)

| Risk | Scenario | Likelihood | Impact | Rating |
|------|----------|-----------|--------|--------|
| — | BOLA (accepted company policy) | — | — | N/A |
| THREAT-007 | getSession() auth bypass | Medium | High | High |
| Mass assignment | Materials PUT accepts arbitrary fields | Medium | Medium | Medium |
| Debug route | Cookie metadata exposed | Low | Medium | Medium |
| Input validation | Limited Zod coverage | Medium | Medium | Medium |

### Key Threat Scenarios

1. **BOLA:** Authenticated users access other clients' credit terms, pricing, and enriched lists.
2. **getSession():** Forged session tokens bypass server-side auth where `getSession()` is used.
3. **Mass assignment:** Materials PUT allows clients to set arbitrary columns.
4. **Debug route:** Cookie content leaked in development/debug responses.
5. **Input validation:** Routes accept unvalidated input; add Zod for type and length constraints.

---

## Remediation Roadmap

### 🔴 Immediate — Fix Within 24–72 Hours

*Active risk; do not wait for a sprint cycle.*

### 🟠 Short-Term — Fix Within 30 Days

*High-severity issues and important process improvements.*

1. **FINDING-003: getSession()** — Replace with `getUser()` in qualityEnsayoService, quotes, orderService, MaterialTechnicalSheetManager, MaterialSafetySheetManager. *Vercel efficiency:* Pass user from route to services to avoid redundant `getUser()` calls.
2. **FINDING-002: Mass assignment** — Allowlist fields in materials PUT.
3. **FINDING-004: Debug route** — Remove or secure; never return cookie content.
4. **FINDING-005: JWT fallback** — Require dedicated JWT secret; fail if missing.
5. **FINDING-006: Error details** — Return generic messages; log full errors server-side only.
6. **FINDING-007: Input validation** — Add Zod to high-risk routes.
7. Migrate from `@supabase/auth-helpers-nextjs` to `@supabase/ssr`.

### 🟡 Medium-Term — Next 60–90 Days

*Technical debt and tooling.*

1. Add input validation (Zod) to all API route handlers.
2. Configure CSP and security headers in `next.config.ts`.
3. Add `npm audit` to CI pipeline.
4. Set up automated dependency scanning (Dependabot or Renovate).
5. Implement MFA for EXECUTIVE/ADMIN_OPERATIONS (NIST AAL2).

### Long-Term — Structural & Governance

1. Implement ASVS L2 formal verification checklist.
2. Add SAST tooling to CI/CD (ESLint security plugins, Semgrep).
3. Conduct quarterly dependency audits.
4. Define security incident response process.
5. Consider penetration testing before production launch.

---

## What's Being Done Well

- **Supabase Auth** used for authentication—avoids common custom auth vulnerabilities.
- **Critical fixes implemented:** create-profile (role, cookie parsing) and clients/details (auth) were fixed in prior sessions.
- **RLS on clients/construction_sites/client_balances** correctly scopes external clients (verified via Supabase MCP).
- **Email confirmations enabled, min password 8** (NIST-compliant).
- **Zustand auth store** with persist for UX; server-side `getUser()` used for authorization.
- **Rate limiting** handled by Vercel Firewall.
- **list-enriched** uses `Promise.all` for parallel fetches.
- **TypeScript** in use—reduces type confusion and many runtime errors.
- **Most API routes** use `getUser()` for authentication.
- **Role checks** present for sensitive operations (create-user, invite-user, admin/client-portal-users).
- **Dependency audit:** 0 Critical/High CVEs.
- **SERVICE_ROLE_KEY** not exposed in client bundles.
- **RLS enabled** on most tables; policies verified correct.
- **Lockfile committed** for deterministic builds.

---

*Report produced by Claude AppSec Suite. Assessment date: 2025-03-17.*
