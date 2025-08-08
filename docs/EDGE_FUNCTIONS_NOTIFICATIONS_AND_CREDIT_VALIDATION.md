# Edge Functions, Notifications, and Credit Validation Flow

This document consolidates the current implementation of our notification systems and credit validation flow across the codebase and the live Supabase project. It includes an inventory of Edge Functions, how credit validation emails with action buttons work end-to-end, data model references, deployment/secrets requirements, and hardening/extension guidelines.

## What’s deployed (Supabase Edge Functions)

The following functions are ACTIVE in the `cotizador` project (id: `pkjqznogflgbnwzkzmpg`). Items marked “not in repo” exist in the project but aren’t present in this workspace; consider exporting and committing them.

- credit-validation-notification
  - Purpose: Sends credit validation emails with Approve/Reject buttons; escalates on validator rejection.
  - Triggers:
    - Database triggers when `orders.credit_status` is set to `pending` (new order) or `rejected_by_validator` (escalation).
    - Direct invocation from the app when needed (escalation in rejection flow).
  - Sends: Per-recipient emails via SendGrid; logs to `order_notifications`; stores action tokens in `credit_action_tokens`.
  - Code: Deployed; canonical source in repo at `migrations/supabase/functions/credit-validation-notification/index.ts`.

- daily-schedule-report
  - Purpose: Daily digest of next day’s deliveries; includes status badges and totals.
  - Sends: SendGrid email to `EXECUTIVE`, `PLANT_MANAGER`, `DOSIFICADOR`, plus order creators; logs in `order_notifications`.
  - Code: `supabase/functions/daily-schedule-report/index.ts`.

- today-schedule-report
  - Purpose: Same as above but for “today”; uses BCC to avoid recipient exposure.
  - Code: `supabase/functions/today-schedule-report/index.ts`.

- ensayo-notification
  - Purpose: Quality module function to enqueue notifications into `quality_notification_queue`.
  - Code: `supabase/functions/ensayo-notification/index.ts`.

- weekly-balance-report (not in repo)
  - Purpose: Weekly customer balance digest; emails to management; records in `system_notifications` (table not present in this repo).
  - Action: Export and commit this function and any related migrations/tables to avoid drift.

- send-actual-notification (not in repo)
  - Purpose: Quality notification sender with rich sample context, using SendGrid.
  - Action: Export and commit along with any related SQL.

## Data model relevant to notifications

- orders
  - Fields used by notifications: `credit_status`, `rejection_reason`, `requires_invoice`, `delivery_date`, `delivery_time`, amounts, creator, etc.
  - Credit statuses (current): `pending`, `approved`, `rejected`, `rejected_by_validator`.

- order_notifications
  - Columns: `id`, `order_id`, `notification_type`, `recipient`, `sent_at`, `delivery_status`.
  - Used by: `credit-validation-notification`, `daily-schedule-report`, `today-schedule-report` (and various SQL fixes).

- credit_action_tokens
  - Columns: `order_id`, `recipient_email`, `approve_token`, `reject_token`, `jwt_token`, `expires_at`.
  - Purpose: Store per-recipient approval/rejection tokens for email action links.
  - RLS: Restricted to service role.

Note: The deployed `weekly-balance-report` writes into `system_notifications` which is not present in this repo. Add corresponding migration if we keep using it.

## Credit validation: end-to-end flow

1) Triggering notifications

- Database triggers (see `migrations/new_roles_and_credit_validation.sql`):
  - On INSERT when `orders.credit_status = 'pending'` → call `credit-validation-notification` with `{ type: 'new_order' }`.
  - On UPDATE when `orders.credit_status` changes to `rejected_by_validator` → call `credit-validation-notification` with `{ type: 'rejected_by_validator' }`.
  - Implementation uses `pg_net` with an Authorization bearer for the function endpoint.

2) Building and sending the email

- Edge Function: `credit-validation-notification`:
  - Fetches order, client, and creator context; computes simple projected balance.
  - Picks recipients by role:
    - `new_order` → `CREDIT_VALIDATOR` users.
    - `rejected_by_validator` → `EXECUTIVE` and `PLANT_MANAGER` for escalation.
  - Generates per-recipient action tokens (JWT-like) with exp = 24h; stores in `credit_action_tokens`.
  - Composes HTML with 3 links:
    - Approve: `${FRONTEND_URL}/api/credit-actions/direct-action?order={id}&action=approve&email={recipient}`
    - Reject: `${FRONTEND_URL}/api/credit-actions/direct-action?order={id}&action=reject&email={recipient}`
    - View: `${FRONTEND_URL}/orders/{id}`
  - Sends via SendGrid; records `order_notifications`.

3) One-click buttons → secure processing

- `/api/credit-actions/direct-action` (Next.js API Route):
  - Looks up `credit_action_tokens` by `order_id` and `recipient_email` (with fallback loose match), then redirects to `/api/credit-actions/process?token={stored_token}`.

- `/api/credit-actions/process` (Next.js API Route):
  - Verifies the JWT with `SUPABASE_JWT_SECRET` (fallback to `SUPABASE_SERVICE_ROLE_KEY`), checks exp, and decodes `{ orderId, action, recipientEmail }`.
  - Confirms token exists in DB for that `orderId` (email fallback allowed) and that `orders.credit_status` is in valid states (`pending` or `rejected_by_validator`).
  - Approve path:
    - Update `orders.credit_status = 'approved'`, set validator, timestamps; log in `order_logs`; delete tokens; redirect to `/orders/{id}?action=approved`.
  - Reject path:
    - If current status was `pending` → set `rejected_by_validator` and a default reason; else → set final `rejected`.
    - Log in `order_logs`; delete tokens; if `rejected_by_validator`, invoke `credit-validation-notification` with `{ type: 'rejected_by_validator' }`; redirect to `/orders/{id}?action=rejected`.

4) User feedback in UI

- The order detail page (`src/app/orders/[id]/page.tsx`) reads the `action` query param (`approved`, `rejected`, `error`) and shows a contextual alert at the top.

## Secrets and configuration

Set these in Supabase functions’ secrets (and relevant server environments):

- SENDGRID_API_KEY: SendGrid API key.
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: For server-side Supabase clients.
- SUPABASE_JWT_SECRET or JWT_SECRET: Used to sign/verify action tokens.
- FRONTEND_URL: Base URL used to build email links.

Next.js server routes use `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`. Ensure these are only referenced in server code.

## Known gaps and recommendations

- Source drift:
  - `weekly-balance-report` and `send-actual-notification` exist in the live project but are not committed here. Export and commit both the function code and any dependent SQL (e.g., `system_notifications`) to avoid configuration drift.

- Webhook auth secret in SQL:
  - The `pg_net` triggers embed a long-lived bearer in migrations. Prefer moving secrets out of SQL: either parameterize via a secure function or use `supabase_functions.http_request` with platform-managed auth where possible.

- Token storage and expiry:
  - We already verify the JWT `exp` in `/process`. Optionally, also enforce DB `expires_at` when looking up tokens to provide a second gate.
  - Consider hashing stored tokens if we decide to store long-lived tokens. Current access is service-role only, which mitigates exposure.

- Idempotency:
  - Tokens are deleted after use. Keep logs (`order_logs`, `order_notifications`) for traceability. Avoid reprocessing by ensuring update statements filter `WHERE id = ... AND credit_status IN (...)` if races are suspected.

- Deliverability:
  - The deployed function disables SendGrid click tracking to preserve exact action URLs (prevents link rewriting). Keep this setting.

## How to add/extend interactive approval emails

Use this playbook to add a new interactive email flow or extend the current one.

1) Decide the trigger
- Database trigger (`pg_net` http_post) on `orders` or other table transitions, or invoke the Edge Function from application code.

2) Edge Function responsibilities
- Read necessary context from DB (order, client, creator, totals).
- Compute recipients by role.
- Generate per-recipient tokens (JWT with 24h exp is already implemented in `credit-validation-notification`).
- Store tokens in a secure table tied to the target entity and recipient.
- Compose HTML with action links to your server route: `/api/{feature}/direct-action?entity={id}&action=...&email=...`.
- Send via SendGrid; record results in a notifications log table.

3) Server routes
- `direct-action`: lookup token in DB by `entity` and `recipient`, redirect to `process?token=...`.
- `process`: verify signature + expiry, validate DB token record and entity state, perform state transition, log, delete tokens, redirect with result query param for UI feedback.

4) UI feedback
- On the destination page, read the `action` param and show success/error banners.

5) Hardening
- Verify both JWT expiry and DB expiry.
- Log to an append-only audit trail (`order_logs`).
- Disable link tracking at email provider level.
- Prefer role-based recipient queries that respect `is_active` users only.

## Testing checklist

- Create an order → verify `pending` credit status triggers email to `CREDIT_VALIDATOR` users.
- Click Approve → order becomes `approved`, tokens deleted, success banner shown.
- Click Reject from validator → order becomes `rejected_by_validator`, escalation email goes to managers; second-stage Reject from managers sets final `rejected`.
- Attempt reusing token → should fail or redirect with error.
- Token expiry → after 24h link should be invalid.

## Useful file references

- Edge Functions
  - `migrations/supabase/functions/credit-validation-notification/index.ts`
  - `supabase/functions/daily-schedule-report/index.ts`
  - `supabase/functions/today-schedule-report/index.ts`
  - `supabase/functions/ensayo-notification/index.ts`

- Next.js API routes
  - `src/app/api/credit-actions/direct-action/route.ts`
  - `src/app/api/credit-actions/process/route.ts`

- SQL
  - `migrations/new_roles_and_credit_validation.sql`
  - `migrations/supabase/webhook-trigger.sql`
  - `migrations/supabase/migrations/20240601000000_add_credit_action_tokens.sql`
  - `migrations/orders_tables.sql` (tables + RLS for `order_notifications`)

## Deploy notes

- Set/verify secrets in Supabase for all deployed functions:
  - `supabase secrets set SENDGRID_API_KEY=... FRONTEND_URL=https://...`
- Deploy or re-deploy functions to sync with codebase:
  - `supabase functions deploy credit-validation-notification`
  - `supabase functions deploy daily-schedule-report`
  - `supabase functions deploy today-schedule-report`
  - `supabase functions deploy ensayo-notification`
- Export and commit `weekly-balance-report` and `send-actual-notification` (and related SQL) to avoid drift.


