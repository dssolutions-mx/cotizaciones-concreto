# SendGrid Invitation Link Tracking Issue

## Problem

SendGrid click tracking is wrapping Supabase invitation and password recovery links, causing two types of authentication failures:

1. **Hash Fragment Loss**: Hash fragments (`#access_token=...&refresh_token=...`) are lost when SendGrid wraps the link, breaking invitation flows
2. **PKCE Flow Breakage**: The PKCE (Proof Key for Code Exchange) flow breaks because the code verifier stored in localStorage doesn't match after SendGrid redirects, causing "both auth code and code verifier should be non-empty" errors

## Root Cause

Supabase uses two authentication flows:
- **Hash-based flow**: Uses hash fragments (`#access_token=...&refresh_token=...`) for invitations
- **PKCE flow**: Uses code exchange with a verifier stored client-side (default for password recovery and magic links)

When SendGrid wraps these links with click tracking, both flows break:
- Hash fragments are lost during redirect
- PKCE code verifiers don't match after redirects

## Recommended Fix (Supabase Project Level)

**Disable click tracking for authentication emails in SendGrid:**

1. Go to Supabase Dashboard → Project Settings → Auth → Email Templates
2. Configure SendGrid SMTP settings to disable click tracking for auth emails
3. OR configure Supabase to use custom email templates that don't get tracked

**Alternative:** Configure SendGrid at the account level to exclude certain URL patterns from tracking (e.g., URLs containing `/auth/callback`).

## Code-Level Workarounds (Already Implemented)

The following improvements have been made to handle this issue:

1. **Enhanced callback handler** (`src/app/(auth)/auth/callback/page.tsx`):
   - Detects SendGrid redirects
   - Attempts to recover session from Supabase after redirect
   - Checks for new users even when hash is missing
   - Handles PKCE errors by attempting session recovery
   - Provides helpful error messages

2. **PKCE error recovery**:
   - Detects PKCE errors ("code verifier" or "invalid request" errors)
   - Attempts to recover session from Supabase when PKCE exchange fails
   - Handles both invitation and password recovery flows

3. **Update password page improvements** (`src/app/(auth)/update-password/page.tsx`):
   - Handles PKCE errors during code exchange
   - Attempts session recovery when PKCE fails
   - Provides clear error messages for SendGrid-related issues

4. **Auth state change listener**:
   - Listens for session establishment via `onAuthStateChange`
   - Handles cases where hash is lost but session is established

5. **Better error handling**:
   - Provides clear error messages when auth parameters are missing
   - Guides users to contact admin or try clicking the link directly
   - Explains that email service link modification is the cause

## Testing

To test the fix:
1. Send an invitation email
2. Click the link (it will go through SendGrid tracking)
3. Verify that the callback handler can recover the session
4. User should be redirected to `/update-password` for new users

## Long-term Solution

The proper fix requires configuring SendGrid at the Supabase project level to disable click tracking for authentication emails. This should be done in the Supabase dashboard under Email Settings.

