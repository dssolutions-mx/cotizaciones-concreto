# Frontend Authentication Implementation Guide

## Overview

This document outlines how authentication is handled in the frontend of the application, the security practices implemented, and the mechanisms in place to prevent common authentication problems.

## Authentication Architecture

### 1. Core Components

#### AuthContext (`src/contexts/AuthContext.tsx`)

The central authentication management system that provides:

- **Global authentication state management** using React Context API
- **Automatic session handling** with token refresh
- **User profile caching** for performance optimization
- **Role-based access control** at the component level

```typescript
// Available user roles
type UserRole = 'QUALITY_TEAM' | 'PLANT_MANAGER' | 'SALES_AGENT' | 
                'EXECUTIVE' | 'CREDIT_VALIDATOR' | 'DOSIFICADOR' | 
                'EXTERNAL_SALES_AGENT';

// Auth context provides these methods
type AuthContextType = {
  supabase: typeof supabase;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, first_name: string, last_name: string) => Promise<{ 
    success: boolean; 
    error?: string;
    message?: string;
  }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
  triggerAuthCheck: (source?: string) => Promise<void>;
};
```

#### Session Manager (`src/components/session-manager.tsx`)

A dedicated component that:
- Listens to authentication state changes
- Triggers context updates on auth events
- Handles `SIGNED_IN`, `TOKEN_REFRESHED`, and `SIGNED_OUT` events

#### Middleware (`middleware.ts`)

Intercepts all requests to:
- Validate authentication status
- Refresh expired sessions automatically
- Implement Content Security Policy (CSP)
- Handle protected route access

### 2. Authentication Flow

#### Login Process

1. **User submits credentials** via login form
2. **AuthContext validates** with Supabase Auth
3. **Session established** and stored in secure cookies
4. **User profile fetched** and cached locally
5. **Automatic redirect** to dashboard or intended destination

```typescript
const signIn = async (email: string, password: string) => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Trigger immediate auth check for faster UI update
    if (data.session) {
      await triggerAuthCheck('signIn');
    }
    
    return { success: true };
  } finally {
    setIsLoading(false);
  }
};
```

#### Session Persistence

- Sessions stored in httpOnly cookies
- Automatic refresh before expiration
- Persistent across browser restarts
- Secure token rotation

### 3. Security Practices

#### Token Management

**Secure Storage**:
- JWT tokens never exposed to JavaScript
- HttpOnly cookies prevent XSS attacks
- SameSite attributes prevent CSRF
- Automatic cleanup on logout

**Token Refresh Strategy**:
```typescript
// Middleware automatically refreshes tokens
const { data: { user } } = await supabase.auth.getUser();
// This call internally refreshes the session if needed
```

#### Protected Routes

**Route Protection Pattern**:
```typescript
// Middleware protection
if (!user && !isPublicRoute) {
  // Redirect to login with return URL
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/login';
  redirectUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(redirectUrl);
}
```

**Component-Level Protection**:
```typescript
// RoleGuard component for UI protection
<RoleGuard allowedRoles={['EXECUTIVE', 'PLANT_MANAGER']}>
  <SensitiveComponent />
</RoleGuard>
```

### 4. Performance Optimizations

#### User Profile Caching

**Cache Implementation**:
```typescript
// Cache user profile to reduce API calls
import { 
  cacheUserProfile, 
  getCachedUserProfile,
  clearUserCache,
  isUserCacheValid
} from '@/lib/cache/userDataCache';
```

**Benefits**:
- Reduces database queries
- Faster page loads
- Better user experience
- Automatic cache invalidation

#### Lazy Loading

- Authentication state loaded asynchronously
- Suspense boundaries for loading states
- Optimistic UI updates

### 5. Error Handling

#### Graceful Degradation

```typescript
// Comprehensive error handling in auth operations
try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('AuthContext: Sign in error:', error.message);
    return { success: false, error: error.message };
  }
} catch (error: any) {
  console.error('AuthContext: Sign in exception:', error);
  return { 
    success: false, 
    error: error.message || 'An unexpected error occurred' 
  };
}
```

#### User-Friendly Messages

- Clear error messages for users
- Technical details logged for debugging
- Fallback UI for auth failures

### 6. Common Problems Prevented

#### Session Synchronization

**Problem**: Session state mismatch between tabs/windows

**Solution**: 
- Global auth state listener
- Cross-tab session synchronization
- Automatic state updates via `onAuthStateChange`

#### Token Expiration

**Problem**: User logged out unexpectedly

**Solution**:
- Proactive token refresh in middleware
- Grace period before expiration
- Seamless background renewal

#### Race Conditions

**Problem**: Multiple simultaneous auth checks

**Solution**:
```typescript
// Debounced auth checks with source tracking
const triggerAuthCheck = useCallback(async (source: string = 'unknown') => {
  console.log(`AuthContext: Triggering manual auth check from [${source}]...`);
  // Implementation prevents concurrent checks
}, [supabase]);
```

#### Memory Leaks

**Problem**: Subscriptions not cleaned up

**Solution**:
```typescript
useEffect(() => {
  let mounted = true;

  // Set up subscription
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, updatedSession) => {
      if (!mounted) return; // Prevent updates after unmount
      // Handle auth changes
    }
  );

  return () => {
    mounted = false;
    subscription?.unsubscribe();
  };
}, []);
```

### 7. Development Best Practices

#### Type Safety

```typescript
// Strongly typed auth context
const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

#### Debugging Support

- Comprehensive console logging in development
- Auth state inspection tools
- Clear error stack traces

#### Testing Considerations

- Mock auth context for unit tests
- Configurable auth states for E2E tests
- Isolated auth logic for easier testing

### 8. Security Headers

**Content Security Policy (CSP)**:
```typescript
// Middleware sets security headers
const cspHeader = getCSPHeader(nonce);
response.headers.set('Content-Security-Policy', cspHeader);
response.headers.set('X-CSP-Nonce', nonce);
```

**Additional Headers**:
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### 9. Monitoring and Analytics

**Auth Event Tracking**:
- Login attempts (success/failure)
- Session duration
- Token refresh frequency
- Error rates

**Performance Metrics**:
- Auth check latency
- Cache hit rates
- Session initialization time

### 10. Future-Proof Design

**Extensibility**:
- Modular auth provider design
- Easy to add new auth methods
- Configurable security policies

**Scalability**:
- Efficient caching strategy
- Minimal database queries
- Optimized for high concurrency

## Conclusion

The frontend authentication system is designed with security, performance, and user experience as top priorities. By implementing multiple layers of protection, automatic session management, and comprehensive error handling, the application provides a robust and reliable authentication experience while preventing common security vulnerabilities and usability issues. 