'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSignedUrls } from '@/hooks/useSignedUrls'
import { supabase } from '@/lib/supabase/client'
import { usePlantContext } from '@/contexts/PlantContext'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import RoleGuard from '@/components/auth/RoleGuard'
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar, Building2, Upload, Search, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface UploadRow {
  id: string
  selected_date: string | null
  uploaded_at: string
  file_name: string
  original_name: string
  file_path: string
  file_size: number
  mime_type: string
  plant_id: string | null
  plant_name: string | null
  uploaded_by: string
  uploaded_by_name: string
}

export default function RelojChecadorPage() {
  const { selectedPlant, currentPlant } = usePlantContext()
  const effectivePlant = currentPlant || selectedPlant || null
  const [file, setFile] = useState<File | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [attestationText, setAttestationText] = useState<string>('Declaro bajo protesta de decir verdad que este archivo no ha sido modificado y refleja fielmente la asistencia diaria. Atentamente, el dosificador responsable.')
  const [rows, setRows] = useState<UploadRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [signerName, setSignerName] = useState('')
  const [confirmAttestation, setConfirmAttestation] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'logs'>('upload')
  const bucket = 'attendance-logs'
  const { getSignedUrl } = useSignedUrls(bucket, 3600)

  const plantId = effectivePlant?.id || null

  const fetchData = useMemo(() => async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedDate) params.set('selected_date', selectedDate)
      if (plantId) params.set('plant_id', plantId)
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await fetch(`/api/attendance/logs?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error cargando lista')
      setRows(json.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, plantId, search, page, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('selected_date', selectedDate)
      if (plantId) form.append('plant_id', plantId)
      // Compute a simple hash client-side for integrity acknowledgement
      if (file) {
        const buffer = await file.arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
        form.append('attestation_text', `${attestationText}\n\nFirmado por: ${signerName}`)
        form.append('attestation_hash', hashArray)
      }

      const res = await fetch('/api/attendance/logs', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error subiendo archivo')
      setFile(null)
      setSelectedDate('')
      setSignerName('')
      setConfirmAttestation(false)
      setActiveTab('logs')
      await fetchData()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleView(path: string) {
    const url = await getSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/logs?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error eliminando')
      await fetchData()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <RoleGuard allowedRoles={['DOSIFICADOR', 'EXECUTIVE', 'ADMIN_OPERATIONS']}>
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-8">
        <InventoryBreadcrumb />

        {/* Header Section */}
        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Upload className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Reloj Checador</CardTitle>
                  <CardDescription>Sube el archivo diario de asistencia y gestiona tus cargas</CardDescription>
                </div>
              </div>
              {effectivePlant && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {effectivePlant.name}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Tabs for Upload and Logs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-2 w-full md:w-auto">
            <TabsTrigger value="upload">Cargar archivo</TabsTrigger>
            <TabsTrigger value="logs">Registro de cargas</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card className="bg-white border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Cargar archivo de asistencia
                </CardTitle>
                <CardDescription>Formatos permitidos: CSV, PDF, imágenes, Excel (XLS/XLSX). Tamaño máx. 10MB.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guided steps */}
                <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
                  <li>Seleccione la fecha del registro</li>
                  <li>Adjunte el archivo del reloj checador</li>
                  <li>Lea y firme la atestación</li>
                  <li>Envíe el registro</li>
                </ol>

                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 md:col-span-1">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <div className="flex flex-col w-full">
                        <span className="text-sm text-gray-700">Fecha del registro (requerida)</span>
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="mt-1"
                          required
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <SimpleFileUpload
                        onFileSelect={(files) => setFile(files?.[0] || null)}
                        acceptedTypes={[
                          'text/csv',
                          'application/pdf',
                          'image/*',
                          'application/vnd.ms-excel',
                          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        ]}
                        multiple={false}
                        maxFiles={1}
                        maxSize={10}
                        uploading={loading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-700">Atestación del dosificador (requerida)</label>
                      <textarea
                        value={attestationText}
                        onChange={(e) => setAttestationText(e.target.value)}
                        className="mt-1 w-full border rounded p-2 text-sm"
                        rows={3}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Se guardará con un hash del archivo para garantizar integridad.</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-700">Nombre completo del dosificador (firma)</label>
                      <Input
                        placeholder="Escriba su nombre para firmar"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        required
                        className="mt-1"
                      />
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          id="attest"
                          type="checkbox"
                          checked={confirmAttestation}
                          onChange={(e) => setConfirmAttestation(e.target.checked)}
                          className="h-4 w-4"
                          required
                        />
                        <label htmlFor="attest" className="text-sm text-gray-700">Confirmo y firmo que el archivo no ha sido alterado</label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={!file || loading || !selectedDate || !signerName || !confirmAttestation}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {loading ? 'Cargando...' : 'Subir archivo'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setFile(null); setSelectedDate(''); setSignerName(''); setConfirmAttestation(false) }} disabled={loading}>
                      Limpiar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="bg-white border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Registro de archivos cargados</CardTitle>
                <CardDescription>Los enlaces se generan bajo demanda para mayor seguridad.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-600" />
                  <Input
                    placeholder="Buscar por nombre de archivo"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => fetchData()} disabled={loading}>
                    Buscar
                  </Button>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full border text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-2 py-1 text-left">Fecha</th>
                        <th className="border px-2 py-1 text-left">Hora</th>
                        <th className="border px-2 py-1 text-left">Subido por</th>
                        <th className="border px-2 py-1 text-left">Planta</th>
                        <th className="border px-2 py-1 text-left">Archivo</th>
                        <th className="border px-2 py-1 text-left">Tamaño</th>
                        <th className="border px-2 py-1 text-left">Tipo</th>
                        <th className="border px-2 py-1 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const date = new Date(r.uploaded_at)
                        const fecha = date.toLocaleDateString('es-MX')
                        const hora = date.toLocaleTimeString('es-MX')
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="border px-2 py-1">{fecha}</td>
                            <td className="border px-2 py-1">{hora}</td>
                            <td className="border px-2 py-1">{r.uploaded_by_name}</td>
                            <td className="border px-2 py-1">{r.plant_name || '-'}</td>
                            <td className="border px-2 py-1">{r.original_name}</td>
                            <td className="border px-2 py-1">{formatBytes(r.file_size)}</td>
                            <td className="border px-2 py-1">{r.mime_type}</td>
                            <td className="border px-2 py-1">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleView(r.file_path)}>Ver</Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </RoleGuard>
  )
}


