import { createClientSupabaseClient } from '@/lib/supabase-client'

export type UploadType = 'entry' | 'adjustment' | 'arkik' | 'general'

interface UploadOptions {
  folder?: string
  maxSize?: number // in MB
  allowedTypes?: string[]
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadDocument(
  file: File,
  uploadType: UploadType,
  options: UploadOptions = {}
): Promise<string> {
  const supabase = createClientSupabaseClient()
  
  const {
    folder = uploadType,
    maxSize = 10,
    allowedTypes = ['image/*', 'application/pdf']
  } = options

  // Validate file size
  if (file.size > maxSize * 1024 * 1024) {
    throw new Error(`El archivo excede el tamaño máximo de ${maxSize}MB`)
  }

  // Validate file type
  const isValidType = allowedTypes.some(type => {
    if (type.includes('*')) {
      const baseType = type.split('/')[0]
      return file.type.startsWith(baseType + '/')
    }
    return file.type === type
  })

  if (!isValidType) {
    throw new Error('Tipo de archivo no permitido')
  }

  // Generate unique filename
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const fileExtension = file.name.split('.').pop()
  const fileName = `${timestamp}-${randomString}.${fileExtension}`
  const filePath = `inventory/${folder}/${fileName}`

  try {
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error(`Error al subir el archivo: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    throw error instanceof Error ? error : new Error('Error desconocido al subir el archivo')
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteDocument(url: string): Promise<void> {
  const supabase = createClientSupabaseClient()
  
  try {
    // Extract file path from URL
    const urlParts = url.split('/storage/v1/object/public/documents/')
    if (urlParts.length !== 2) {
      throw new Error('URL de documento inválida')
    }
    
    const filePath = urlParts[1]

    const { error } = await supabase.storage
      .from('documents')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      throw new Error(`Error al eliminar el archivo: ${error.message}`)
    }
  } catch (error) {
    console.error('Delete error:', error)
    throw error instanceof Error ? error : new Error('Error desconocido al eliminar el archivo')
  }
}

/**
 * Get file metadata from Supabase Storage
 */
export async function getFileMetadata(url: string) {
  const supabase = createClientSupabaseClient()
  
  try {
    // Extract file path from URL
    const urlParts = url.split('/storage/v1/object/public/documents/')
    if (urlParts.length !== 2) {
      throw new Error('URL de documento inválida')
    }
    
    const filePath = urlParts[1]

    const { data, error } = await supabase.storage
      .from('documents')
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      })

    if (error) {
      throw new Error(`Error al obtener metadatos: ${error.message}`)
    }

    return data?.[0] || null
  } catch (error) {
    console.error('Metadata error:', error)
    return null
  }
}

/**
 * Validate if a file URL is accessible
 */
export async function validateFileUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
