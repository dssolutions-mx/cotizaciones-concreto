import { UserRole } from '@/contexts/AuthContext';

/**
 * Interface for user profile data to be cached
 */
export interface CachedUserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
}

/**
 * Cache keys for user-related data
 */
export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_PERMISSIONS: 'user_permissions',
  SESSION_EXPIRY: 'session_expiry',
  LAST_REFRESH: 'last_session_refresh'
};

/**
 * Cache expiry times (in milliseconds)
 */
export const CACHE_EXPIRY = {
  USER_PROFILE: 60 * 60 * 1000, // 1 hour
  PERMISSIONS: 30 * 60 * 1000, // 30 minutes
  SESSION: 15 * 60 * 1000 // 15 minutes
};

/**
 * Saves data to localStorage with an expiry time
 */
export function setWithExpiry<T>(key: string, value: T, expiryTime: number) {
  const item = {
    value,
    expiry: Date.now() + expiryTime,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(item));
    return true;
  } catch (error) {
    console.error(`Error caching ${key}:`, error);
    return false;
  }
}

/**
 * Gets data from localStorage and checks if it's expired
 */
export function getWithExpiry<T>(key: string, defaultValue: T | null = null): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    
    // Return default value if item doesn't exist
    if (!itemStr) return defaultValue;
    
    const item = JSON.parse(itemStr);
    const isExpired = Date.now() > item.expiry;
    
    // Return default value if expired
    if (isExpired) {
      localStorage.removeItem(key);
      return defaultValue;
    }
    
    return item.value;
  } catch (error) {
    console.error(`Error retrieving ${key} from cache:`, error);
    return defaultValue;
  }
}

/**
 * Caches the user profile
 */
export function cacheUserProfile(profile: CachedUserProfile | null) {
  if (!profile) {
    localStorage.removeItem(CACHE_KEYS.USER_PROFILE);
    return false;
  }
  
  return setWithExpiry(CACHE_KEYS.USER_PROFILE, profile, CACHE_EXPIRY.USER_PROFILE);
}

/**
 * Retrieves the cached user profile
 */
export function getCachedUserProfile(): CachedUserProfile | null {
  return getWithExpiry<CachedUserProfile>(CACHE_KEYS.USER_PROFILE);
}

/**
 * Caches the session expiry time
 */
export function cacheSessionExpiry(expiresAt: Date | null) {
  if (!expiresAt) {
    localStorage.removeItem(CACHE_KEYS.SESSION_EXPIRY);
    return false;
  }
  
  return setWithExpiry(
    CACHE_KEYS.SESSION_EXPIRY, 
    expiresAt.getTime(),
    // Cache until expiry
    expiresAt.getTime() - Date.now()
  );
}

/**
 * Gets the cached session expiry time
 */
export function getCachedSessionExpiry(): Date | null {
  const timestamp = getWithExpiry<number>(CACHE_KEYS.SESSION_EXPIRY);
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Caches the last session refresh time
 */
export function cacheLastRefresh(refreshTime: Date | null) {
  if (!refreshTime) {
    localStorage.removeItem(CACHE_KEYS.LAST_REFRESH);
    return false;
  }
  
  return setWithExpiry(
    CACHE_KEYS.LAST_REFRESH,
    refreshTime.getTime(),
    CACHE_EXPIRY.SESSION
  );
}

/**
 * Gets the cached last refresh time
 */
export function getCachedLastRefresh(): Date | null {
  const timestamp = getWithExpiry<number>(CACHE_KEYS.LAST_REFRESH);
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Clears all user-related cache data
 */
export function clearUserCache() {
  localStorage.removeItem(CACHE_KEYS.USER_PROFILE);
  localStorage.removeItem(CACHE_KEYS.USER_PERMISSIONS);
  localStorage.removeItem(CACHE_KEYS.SESSION_EXPIRY);
  localStorage.removeItem(CACHE_KEYS.LAST_REFRESH);
}

/**
 * Checks if user cache is still valid
 */
export function isUserCacheValid(): boolean {
  const profile = getCachedUserProfile();
  return !!profile;
} 