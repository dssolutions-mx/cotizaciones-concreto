# Vercel Firewall Rules Configuration Guide

This document provides instructions for configuring Vercel Firewall rules to block malicious access attempts detected in your application.

## Detected Malicious Access Patterns

Based on the "Top Request Paths" analysis, the following malicious access attempts were detected:

1. **Environment Files**: `/.env` - Attempts to access sensitive configuration
2. **Git Repository**: `/.git/config` - Attempts to access source code repository
3. **Laravel Exploits**: 
   - `/_ignition/execute-solution` - Remote Code Execution (RCE) exploit attempt
   - `/public/_ignition/execute-solution` - Another RCE attempt
   - `/vendor/laravel-filemanager` - File manager exploit
   - `/vendor/phpunit` - Testing framework exploit
4. **Common Exploit Paths**: Various PHP and WordPress-related paths

## Implementation

### 1. Middleware Protection (Already Implemented)

The `proxy.ts` middleware now includes early blocking of malicious paths before any processing occurs. This provides application-level protection.

### 2. Vercel Firewall Rules (Recommended)

For additional protection at the edge, configure Firewall rules in the Vercel Dashboard:

#### Steps to Configure:

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click on the **"Firewall"** tab
   - Click on **"Rules"**

2. **Create Block Rules**

Create the following rules to block malicious paths:

#### Rule 1: Block Environment Files
```
Path: Matches regex
Pattern: ^/\.env.*$
Action: Block
```

#### Rule 2: Block Git Repository Access
```
Path: Matches regex
Pattern: ^/\.git(/.*)?$
Action: Block
```

#### Rule 3: Block Laravel Exploit Attempts
```
Path: Matches regex
Pattern: ^/(public/)?(_ignition|vendor/laravel-filemanager|vendor/phpunit).*$
Action: Block
```

#### Rule 4: Block Common Exploit Patterns
```
Path: Matches regex
Pattern: ^/(wp-|phpinfo|\.htaccess|\.htpasswd|web\.config|composer\.(json|lock)|database\.sql|backup.*|tmp|temp).*$
Action: Block
```

#### Rule 5: Block Sensitive File Extensions
```
Path: Matches regex
Pattern: ^.*\.(env|git|sql|bak|old|orig|log)$
Action: Block
```

### 3. Rate Limiting (Additional Protection)

Consider adding rate limiting rules for suspicious patterns:

1. **Go to Firewall → Rules → Rate Limiting**
2. **Create Rate Limit Rule**:
   - **Path**: `*` (all paths)
   - **Limit**: 100 requests per minute per IP
   - **Action**: Challenge or Block after limit

### 4. BotID Deep Analysis (Already Configured)

BotID is already configured in the application. Enable Deep Analysis in Vercel Dashboard:

1. **Go to Firewall → Rules**
2. **Enable "Vercel BotID Deep Analysis"**
   - Available on Pro and Enterprise plans
   - Provides advanced bot detection

## Monitoring

### View Blocked Requests

1. **Go to Firewall → Logs**
2. **Filter by**: Action = "Blocked"
3. **Review patterns** to identify new attack vectors

### Set Up Alerts

1. **Go to Observability → Alerts**
2. **Create alert** for:
   - High number of blocked requests
   - Specific malicious patterns
   - Unusual traffic spikes

## Additional Security Recommendations

### 1. Security Headers

Ensure security headers are set (already configured in middleware):
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### 2. IP Blocking

For persistent attackers:
1. **Go to Firewall → IP Blocking**
2. **Add IP addresses** that repeatedly attempt malicious access

### 3. Geographic Restrictions (If Applicable)

If your application should only be accessed from specific regions:
1. **Go to Firewall → Rules**
2. **Create Geo-blocking rule**
3. **Allow only** your target countries

## Testing

After configuring firewall rules:

1. **Test legitimate access** - Ensure normal users can access the application
2. **Test blocked paths** - Verify malicious paths are blocked:
   ```bash
   curl -I https://your-domain.com/.env
   # Should return 403 Forbidden
   ```

## Maintenance

- **Review logs weekly** for new attack patterns
- **Update rules** as new threats emerge
- **Monitor false positives** and adjust rules accordingly
- **Keep BotID enabled** for continuous protection

## References

- [Vercel Firewall Documentation](https://vercel.com/docs/security/firewall)
- [Vercel BotID Documentation](https://vercel.com/docs/botid/get-started)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common security vulnerabilities
