import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Custom storage implementation that doesn't rely on eval
const customStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from localStorage', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in localStorage', error);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from localStorage', error);
    }
  }
};

// Track recent auth calls to prevent duplicate requests
const recentAuthCalls = new Map<string, number>();

// Custom fetch implementation with retry logic and smart rate limiting for auth endpoints
const customFetch = (...args: Parameters<typeof fetch>): Promise<Response> => {
  const [url, options] = args;
  
  // Parse URL and method for better decision making
  const urlStr = typeof url === 'string' ? url : url.toString();
  const method = options?.method || 'GET';
  
  // Only apply special handling to Supabase auth endpoints
  const isAuthEndpoint = urlStr.includes('/auth/v1/');
  
  if (!isAuthEndpoint) {
    return fetch(...args);
  }
  
  // Determine the type of auth operation for appropriate handling
  const isSignInRequest = urlStr.includes('/auth/v1/token') && 
                          (options?.body?.toString()?.includes('grant_type=password') ||
                           options?.body?.toString()?.includes('grant_type=oauth'));
  const isSignUpRequest = urlStr.includes('/auth/v1/signup');
  const isRefreshTokenRequest = urlStr.includes('/auth/v1/token') && 
                               options?.body?.toString()?.includes('grant_type=refresh_token');
  const isGetUserRequest = urlStr.includes('/auth/v1/user');
  
  // Critical auth operations should not be rate-limited
  const isCriticalAuthOperation = isSignInRequest || isSignUpRequest;
  
  // Create a cache key based on URL and request method
  const cacheKey = `${method}:${urlStr}`;
  const now = Date.now();
  
  // Apply rate limiting only to non-critical and duplicate auth calls
  if (!isCriticalAuthOperation && recentAuthCalls.has(cacheKey)) {
    const lastCallTime = recentAuthCalls.get(cacheKey) || 0;
    const timeSinceLastCall = now - lastCallTime;
    
    // Different rate limiting based on operation type
    const minTimeBetweenCalls = isRefreshTokenRequest ? 2000 : // 2 seconds for refresh
                               isGetUserRequest ? 3000 :     // 3 seconds for user check
                               5000;                        // 5 seconds for other operations
    
    if (timeSinceLastCall < minTimeBetweenCalls) {
      console.log(`Rate limiting auth call to ${urlStr.substring(0, 50)}... (called ${timeSinceLastCall}ms ago)`);
      
      // For getUser requests, immediately return the last response if we're calling too frequently
      if (isGetUserRequest && timeSinceLastCall < 500) {
        return fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            'x-from-cache': 'true'
          },
          cache: 'force-cache'
        });
      }
      
      // For other requests, delay but still make the call
      return new Promise((resolve) => {
        setTimeout(() => {
          // Make the actual call after waiting
          fetch(...args).then(resolve);
          // Update the timestamp after this delayed call
          recentAuthCalls.set(cacheKey, Date.now());
        }, minTimeBetweenCalls - timeSinceLastCall);
      });
    }
  }
  
  // Update the timestamp for this call
  recentAuthCalls.set(cacheKey, now);
  
  // Clean up old entries from the map to prevent memory leaks
  const oldEntryThreshold = now - 60000; // Entries older than 1 minute
  recentAuthCalls.forEach((timestamp, key) => {
    if (timestamp < oldEntryThreshold) {
      recentAuthCalls.delete(key);
    }
  });
  
  // Special handling for sign-in/sign-up (no retries needed, but add timeout)
  if (isCriticalAuthOperation) {
    return fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(15000) // 15 second timeout for login operations
    });
  }
  
  // For other auth endpoints, use a retry mechanism with rate limiting
  return new Promise((resolve, reject) => {
    const attemptFetch = (retryCount = 0, delay = 1000) => {
      fetch(...args)
        .then(response => {
          // If we get a successful response or a 4xx client error, don't retry
          if (response.ok || (response.status >= 400 && response.status < 500)) {
            resolve(response);
          } else if (retryCount < 2) {
            // For server errors (5xx), retry with exponential backoff
            console.warn(`Auth request failed (${response.status}), retrying in ${delay}ms...`);
            setTimeout(() => attemptFetch(retryCount + 1, delay * 2), delay);
          } else {
            // If we've exhausted retries, return the last response
            console.error(`Auth request failed after ${retryCount} retries`);
            resolve(response);
          }
        })
        .catch(error => {
          // For network errors, retry with exponential backoff
          if (retryCount < 2) {
            console.warn(`Network error during auth request, retrying in ${delay}ms...`, error);
            setTimeout(() => attemptFetch(retryCount + 1, delay * 2), delay);
          } else {
            console.error(`Auth request failed after ${retryCount} retries:`, error);
            reject(error);
          }
        });
    };
    
    attemptFetch();
  });
};

// This function is kept for backward compatibility and server-side usage
// but for client components, prefer using the exported singleton instance
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: customStorage,
        debug: process.env.NODE_ENV === 'development', // Enable debug logs in development
        // Explicitly set the storage key to avoid conflicts
        storageKey: 'supabase-auth-token',
      },
      global: {
        // Add custom headers to help with CSP issues and 406 errors
        headers: {
          'X-Client-Info': 'supabase-js-v2',
          'Accept': 'application/json'
        },
        // Use our custom fetch implementation with retries
        fetch: customFetch
      },
      // Set a reasonable timeout for requests
      realtime: {
        timeout: 30000 // 30 seconds
      }
    }
  );
}

// Create a singleton instance for direct imports
// IMPORTANT: Always use this singleton instance in client components
// to avoid "Multiple GoTrueClient instances" warning
const supabase = createClient();

export { supabase }; 