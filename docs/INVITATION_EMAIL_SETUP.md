# Invitation Email Setup

Admin user invitations are sent **directly from the app via SendGrid** (not from Supabase). This matches the client portal invites and password reset flow for more reliable delivery.

## How It Works

1. Admin invites a user → `invite-user` API creates the user (no Supabase email), stores a token in `invitation_tokens`, and sends an email via SendGrid
2. Email contains: `https://dcconcretos-hub.com/api/auth/verify-invitation?token=...` (query params survive email tracking)
3. User clicks → hits our API → we validate the token, generate a Supabase magic link, redirect the user
4. User lands on `/update-password?type=invite` to set their password

## Requirements

1. **SENDGRID_API_KEY** must be set in the environment (Vercel, `.env.local`, etc.)
2. **NEXT_PUBLIC_APP_URL** should be `https://dcconcretos-hub.com` in production

## Supabase Configuration (Optional)

If you also use Supabase for other auth emails (e.g. password recovery via Supabase), configure:

- **Authentication** → **URL Configuration** → **Site URL**: `https://dcconcretos-hub.com`
- **Redirect URLs**: include `https://dcconcretos-hub.com/auth/callback`

Admin invites do **not** use Supabase email templates.

## Verification

1. Invite a new user from the admin panel
2. Check the email - the link should point to `https://dcconcretos-hub.com/api/auth/verify-invitation?token=...`
3. Click the link - user should be redirected and land on `/update-password?type=invite`
4. Set password and confirm - user should have the correct role and access

## Troubleshooting

- **"Email service not configured"**: Set `SENDGRID_API_KEY` in your environment.
- **"Failed to send invitation email"**: Check SendGrid dashboard for delivery status; verify the API key has permission to send.
- **"Invalid token" / "Expired token"**: Tokens expire in 7 days and are single-use. Ask the admin to resend the invitation.
- **Wrong redirect domain**: Ensure `NEXT_PUBLIC_APP_URL` is `https://dcconcretos-hub.com` in production.
