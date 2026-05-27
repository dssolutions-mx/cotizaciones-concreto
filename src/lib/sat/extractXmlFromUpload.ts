import JSZip from 'jszip'

export type XmlEntry = { name: string; text: string }

export type ExtractXmlResult = {
  entries: XmlEntry[]
  source: 'zip' | 'xml' | 'xml_files'
}

/**
 * Extract XML text entries from multipart FormData.
 * Supports zip_file, single xml_file, or repeated xml_files[].
 */
export async function extractXmlFromFormData(form: FormData): Promise<ExtractXmlResult | { error: string }> {
  const zipFile = form.get('zip_file')
  const xmlFile = form.get('xml_file')
  const xmlFiles = form.getAll('xml_files[]').filter((f): f is File => f instanceof File)

  if (zipFile instanceof File) {
    const buffer = await zipFile.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const entries: XmlEntry[] = []
    for (const [name, entry] of Object.entries(zip.files)) {
      if (!name.toLowerCase().endsWith('.xml') || entry.dir) continue
      entries.push({ name, text: await entry.async('string') })
    }
    if (entries.length === 0) {
      return { error: 'No se encontraron archivos XML en el ZIP' }
    }
    return { entries, source: 'zip' }
  }

  if (xmlFiles.length > 0) {
    const entries: XmlEntry[] = []
    for (const file of xmlFiles) {
      entries.push({ name: file.name, text: await file.text() })
    }
    return { entries, source: 'xml_files' }
  }

  if (xmlFile instanceof File) {
    return {
      entries: [{ name: xmlFile.name, text: await xmlFile.text() }],
      source: 'xml',
    }
  }

  return { error: 'Se requiere zip_file, xml_file o xml_files[]' }
}
