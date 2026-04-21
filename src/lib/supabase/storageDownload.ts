import { supabase } from '@/lib/supabase/client'

export const REMISION_DOCUMENTS_BUCKET = 'remision-documents'

/**
 * Download a storage object using the authenticated Supabase client (avoids CORS issues
 * that often break `fetch(signedUrl)` when building ZIPs or merged PDFs in the browser).
 */
export async function downloadStorageFileArrayBuffer(
  bucket: string,
  objectPath: string
): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath)
  if (error || !data) {
    console.error('[storage download]', bucket, objectPath, error)
    return null
  }
  try {
    return await data.arrayBuffer()
  } catch (e) {
    console.error('[storage download] arrayBuffer', e)
    return null
  }
}
