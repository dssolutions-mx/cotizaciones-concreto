'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  Plus, 
  Edit,
  FileText,
  User,
  Clock,
  DollarSign,
  ArrowUpDown,
  Paperclip,
  Eye,
  Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MaterialEntry, InventoryDocument } from '@/types/inventory'
import Link from 'next/link'
import { toast } from 'sonner'

interface MaterialEntriesListProps {
  date: Date
  isEditing: boolean
}

// Documents Section Component
function DocumentsSection({ entryId, isEditing }: { entryId: string; isEditing: boolean }) {
  const [documents, setDocuments] = useState<InventoryDocument[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [entryId])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/inventory/documents?reference_id=${entryId}&type=entry`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?id=${documentId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId))
        toast.success('Documento eliminado correctamente')
      } else {
        const error = await response.json()
        toast.error(`Error al eliminar documento: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Error al eliminar documento')
    }
  }

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return null
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Documentos ({documents.length})
      </h5>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-white rounded border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-700 truncate">{doc.original_name}</span>
              <span className="text-xs text-gray-500">
                {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                  title="Ver documento"
                >
                  <Eye className="h-3 w-3" />
                </a>
              )}
              {isEditing && (
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  title="Eliminar documento"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MaterialEntriesList({ date, isEditing }: MaterialEntriesListProps) {
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEntries()
  }, [date])

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/inventory/entries?date=${dateStr}`)
      
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
      }
    } catch (error) {
      console.error('Error fetching entries:', error)
      toast.error('Error al cargar las entradas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay entradas registradas
          </h3>
          <p className="text-gray-500 text-center mb-4">
            No se han registrado entradas de materiales para este día
          </p>
          {isEditing && (
            <Link href="/production-control/entries">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Nueva Entrada
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Button */}
      {isEditing && (
        <div className="flex justify-end">
          <Link href="/production-control/entries">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Entrada
            </Button>
          </Link>
        </div>
      )}

      {/* Entries List */}
      {entries.map((entry) => (
        <Card key={entry.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{entry.entry_number}</CardTitle>
                  <CardDescription>
                    {format(new Date(`${entry.entry_date}T${entry.entry_time}`), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Entrada</Badge>
                {isEditing && (
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Material Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Material</h4>
                <p className="text-sm text-gray-600">ID: {entry.material_id}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Cantidad Recibida</h4>
                <p className="text-lg font-semibold text-green-600">
                  {entry.quantity_received.toLocaleString('es-MX', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })} kg
                </p>
              </div>
            </div>

            {/* Cost Information */}
            {(entry.unit_price || entry.total_cost) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                {entry.unit_price && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Precio unitario: ${entry.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {entry.total_cost && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      Total: ${entry.total_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Inventory Changes */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                Inventario: {entry.inventory_before.toLocaleString('es-MX')} → {entry.inventory_after.toLocaleString('es-MX')} kg
              </span>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {entry.supplier_invoice && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Remisión: {entry.supplier_invoice}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {entry.notes && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <h5 className="text-sm font-medium text-yellow-900 mb-1">Notas</h5>
                <p className="text-sm text-yellow-800">{entry.notes}</p>
              </div>
            )}

            {/* Documents */}
            <DocumentsSection entryId={entry.id} isEditing={isEditing} />

            {/* Footer Info */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Registrado por: {entry.entered_by}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
