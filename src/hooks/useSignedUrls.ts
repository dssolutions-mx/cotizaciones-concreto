'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface CachedUrl {
  url: string
  expiresAt: number
}

interface SignedUrlCache {
  [filePath: string]: CachedUrl
}

/**
 * Hook for managing Supabase signed URLs with client-side caching
 * Follows Supabase best practices for dynamic and secure file access
 */
export function useSignedUrls(bucket: string, defaultExpirySeconds: number = 3600) {
  const cacheRef = useRef<SignedUrlCache>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())

  // Clear expired URLs from cache
  const clearExpiredUrls = useCallback(() => {
    const now = Date.now()
    const cache = cacheRef.current
    
    Object.keys(cache).forEach(filePath => {
      if (cache[filePath].expiresAt <= now) {
        delete cache[filePath]
      }
    })
  }, [])

  // Generate single signed URL with caching
  const getSignedUrl = useCallback(async (
    filePath: string, 
    expirySeconds: number = defaultExpirySeconds
  ): Promise<string | null> => {
    clearExpiredUrls()
    
    // Check cache first
    const cached = cacheRef.current[filePath]
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url
    }

    // Set loading state
    setLoading(prev => new Set(prev).add(filePath))
    
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expirySeconds)

      if (error || !data?.signedUrl) {
        console.error(`Failed to create signed URL for ${filePath}:`, error)
        return null
      }

      // Cache the URL with expiry time (subtract 60 seconds buffer for safety)
      const expiresAt = Date.now() + (expirySeconds - 60) * 1000
      cacheRef.current[filePath] = {
        url: data.signedUrl,
        expiresAt
      }

      return data.signedUrl
    } catch (error) {
      console.error(`Error generating signed URL for ${filePath}:`, error)
      return null
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(filePath)
        return newSet
      })
    }
  }, [bucket, defaultExpirySeconds, clearExpiredUrls])

  // Generate multiple signed URLs (batch operation)
  const getSignedUrls = useCallback(async (
    filePaths: string[], 
    expirySeconds: number = defaultExpirySeconds
  ): Promise<Record<string, string | null>> => {
    clearExpiredUrls()
    
    // Separate cached and uncached paths
    const now = Date.now()
    const results: Record<string, string | null> = {}
    const pathsToFetch: string[] = []

    filePaths.forEach(filePath => {
      const cached = cacheRef.current[filePath]
      if (cached && cached.expiresAt > now) {
        results[filePath] = cached.url
      } else {
        pathsToFetch.push(filePath)
        results[filePath] = null // Initialize as null
      }
    })

    // Fetch uncached URLs in batch
    if (pathsToFetch.length > 0) {
      // Set loading state for all paths being fetched
      setLoading(prev => {
        const newSet = new Set(prev)
        pathsToFetch.forEach(path => newSet.add(path))
        return newSet
      })

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(pathsToFetch, expirySeconds)

        if (error) {
          console.error('Batch signed URL creation failed:', error)
        } else if (data) {
          const expiresAt = Date.now() + (expirySeconds - 60) * 1000

          data.forEach((item, index) => {
            const filePath = pathsToFetch[index]
            if (item.signedUrl && !item.error) {
              // Cache successful URLs
              cacheRef.current[filePath] = {
                url: item.signedUrl,
                expiresAt
              }
              results[filePath] = item.signedUrl
            } else {
              console.error(`Failed to create signed URL for ${filePath}:`, item.error)
              results[filePath] = null
            }
          })
        }
      } catch (error) {
        console.error('Error in batch signed URL generation:', error)
      } finally {
        // Clear loading state
        setLoading(prev => {
          const newSet = new Set(prev)
          pathsToFetch.forEach(path => newSet.delete(path))
          return newSet
        })
      }
    }

    return results
  }, [bucket, defaultExpirySeconds, clearExpiredUrls])

  // Check if a file path is currently loading
  const isLoading = useCallback((filePath: string) => {
    return loading.has(filePath)
  }, [loading])

  // Clear cache manually
  const clearCache = useCallback(() => {
    cacheRef.current = {}
  }, [])

  // Get cached URL without fetching (for immediate access)
  const getCachedUrl = useCallback((filePath: string): string | null => {
    const cached = cacheRef.current[filePath]
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url
    }
    return null
  }, [])

  return {
    getSignedUrl,
    getSignedUrls,
    isLoading,
    clearCache,
    getCachedUrl
  }
}
