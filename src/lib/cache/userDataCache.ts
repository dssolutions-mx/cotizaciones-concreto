import type { UserRole } from '@/store/auth/types';

/**
 * Interface for user profile data to be cached
 */
export interface CachedUserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  plant_id: string | null;
  business_unit_id: string | null;
}

/**
 * Cache keys for user-related data
 */
export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  // Removed USER_PERMISSIONS, SESSION_EXPIRY, LAST_REFRESH keys
};

/**
 * Cache expiry times (in milliseconds)
 */
export const CACHE_EXPIRY = {
  USER_PROFILE: 60 * 60 * 1000, // 1 hour
  // Removed PERMISSIONS and SESSION expiry times
};

/**
 * Saves data to localStorage with an expiry time
 */
export function setWithExpiry<T>(key: string, value: T, expiryTime: number) {
  // Check if localStorage is available (for SSR or environments without it)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('localStorage is not available, caching disabled.');
    return false;
  }
  
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
    // Handle potential quota exceeded errors
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      console.error('LocalStorage quota exceeded. Consider clearing some data.');
      // Optional: implement cache eviction strategy here
    }
    return false;
  }
}

/**
 * Gets data from localStorage and checks if it's expired
 */
export function getWithExpiry<T>(key: string, defaultValue: T | null = null): T | null {
  // Check if localStorage is available
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return defaultValue;
  }
  
  try {
    const itemStr = localStorage.getItem(key);
    
    // Return default value if item doesn't exist
    if (!itemStr) return defaultValue;
    
    const item = JSON.parse(itemStr);
    
    // Basic check for item structure
    if (!item || typeof item !== 'object' || !item.hasOwnProperty('value') || !item.hasOwnProperty('expiry')) {
      console.warn(`Invalid cache item format for key: ${key}. Removing.`);
      localStorage.removeItem(key);
      return defaultValue;
    }
    
    const isExpired = Date.now() > item.expiry;
    
    // Return default value if expired
    if (isExpired) {
      console.log(`Cache expired for key: ${key}. Removing.`);
      localStorage.removeItem(key);
      return defaultValue;
    }
    
    return item.value as T; // Added type assertion
  } catch (error) {
    console.error(`Error retrieving ${key} from cache:`, error);
    // Attempt to remove potentially corrupted item
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.error(`Failed to remove potentially corrupted cache item for key: ${key}`, removeError);
    }
    return defaultValue;
  }
}

/**
 * Caches the user profile
 */
export function cacheUserProfile(profile: CachedUserProfile | null) {
  if (!profile) {
    // Check localStorage availability before removing
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(CACHE_KEYS.USER_PROFILE);
    }
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

// Removed cacheSessionExpiry function
// Removed getCachedSessionExpiry function
// Removed cacheLastRefresh function
// Removed getCachedLastRefresh function

/**
 * Clears all user-related cache data (now just the profile)
 */
export function clearUserCache() {
  // Check localStorage availability before removing
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(CACHE_KEYS.USER_PROFILE);
    // Removed USER_PERMISSIONS, SESSION_EXPIRY, LAST_REFRESH removals
  }
}

/**
 * Checks if user cache is still valid (checks if profile exists and is not expired)
 */
export function isUserCacheValid(): boolean {
  const profile = getCachedUserProfile();
  return !!profile;
} 