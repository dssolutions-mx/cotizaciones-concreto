const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i
const SR3_EXT = /\.sr3$/i

export function isEnsayoImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return IMAGE_EXT.test(file.name)
}

export function isEnsayoSr3File(file: File): boolean {
  return SR3_EXT.test(file.name.toLowerCase())
}

export function evidenciaStoragePath(
  ensayoId: string,
  file: File,
  kind: 'photo' | 'machine'
): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const prefix = kind === 'photo' ? 'photos' : 'machine'
  return `${ensayoId}/${prefix}/${Date.now()}_${safeName}`
}

export function evidenciaPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!path) return ''
  if (path.startsWith('http')) return path
  if (path.startsWith('evidencias/')) {
    return `${base}/storage/v1/object/public/quality-evidencias/${path}`
  }
  return `${base}/storage/v1/object/public/evidencia-ensayos/${path}`
}

export function evidenciaFallbackUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!path || path.startsWith('http')) return ''
  return `${base}/storage/v1/object/public/quality/${path}`
}

export function isEvidenciaDisplayImage(
  tipoArchivo: string,
  nombreArchivo: string
): boolean {
  if (tipoArchivo.startsWith('image/')) return true
  return IMAGE_EXT.test(nombreArchivo || '')
}

export type NormalizedEvidencia = {
  id: string
  ensayo_id: string
  path: string
  archivo_url?: string
  nombre_archivo: string
  tipo_archivo: string
  tamano_kb: number
  _path: string
  isImage: boolean
  isSr3: boolean
}

export function normalizeEvidencia(raw: Record<string, unknown>): NormalizedEvidencia {
  const path =
    (raw.path as string) ||
    (raw.archivo_url as string) ||
    (raw.file_path as string) ||
    ''
  const nombre_archivo =
    (raw.nombre_archivo as string) || (raw.file_name as string) || 'Archivo'
  const tipo_archivo =
    (raw.tipo_archivo as string) ||
    (raw.file_type as string) ||
    (raw.mime_type as string) ||
    ''
  return {
    id: String(raw.id),
    ensayo_id: String(raw.ensayo_id ?? ''),
    path,
    archivo_url: raw.archivo_url as string | undefined,
    nombre_archivo,
    tipo_archivo,
    tamano_kb:
      Number(raw.tamano_kb ?? (raw.file_size ? Number(raw.file_size) / 1024 : 0)) || 0,
    _path: path,
    isImage: isEvidenciaDisplayImage(tipo_archivo, nombre_archivo),
    isSr3: SR3_EXT.test(nombre_archivo.toLowerCase()) || tipo_archivo.includes('sr3'),
  }
}

export type EnsayoEvidenceUploadResult = {
  uploaded: number
  failed: { name: string; error: string }[]
}
