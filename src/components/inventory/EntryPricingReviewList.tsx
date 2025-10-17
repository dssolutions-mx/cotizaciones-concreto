'use client'

import React, { useEffect, useState } from 'react'
import { MaterialEntry } from '@/types/inventory'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Package, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import EntryPricingForm from './EntryPricingForm'

interface EntryPricingReviewListProps {
  onSuccess?: () => void
}

export default function EntryPricingReviewList({ onSuccess }: EntryPricingReviewListProps) {
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<MaterialEntry | null>(null)

  useEffect(() => {
    fetchPendingEntries()
  }, [])

  const fetchPendingEntries = async () => {
    setLoading(true)
    try {
      // Fetch entries from last 30 days with pending pricing status
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const fromStr = format(from, 'yyyy-MM-dd')
      const toStr = format(new Date(), 'yyyy-MM-dd')
      
      const url = `/api/inventory/entries?date_from=${fromStr}&date_to=${toStr}&pricing_status=pending&limit=100`
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
      }
    } catch (error) {
      console.error('Error fetching pending entries:', error)
      toast.error('Error al cargar entradas pendientes')
    } finally {
      setLoading(false)
    }
  }

  const handlePricingSuccess = () => {
    setSelectedEntry(null)
    fetchPendingEntries()
    onSuccess?.()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay entradas pendientes
        </h3>
        <p className="text-gray-500">
          Todas las entradas han sido revisadas
        </p>
      </div>
    )
  }

  if (selectedEntry) {
    return (
      <div>
        <EntryPricingForm
          entry={selectedEntry}
          onSuccess={handlePricingSuccess}
          onCancel={() => setSelectedEntry(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span>{entries.length} entrada{entries.length !== 1 ? 's' : ''} pendiente{entries.length !== 1 ? 's' : ''} de revisión</span>
      </div>

      {entries.map((entry) => (
        <div 
          key={entry.id}
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => setSelectedEntry(entry)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm font-medium text-gray-900">
                  {entry.entry_number}
                </span>
                <span className="text-xs text-gray-500">
                  {format(new Date(entry.entry_date), "dd MMM yyyy", { locale: es })}
                </span>
              </div>
              
              <div className="space-y-1">
                {entry.material && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {entry.material.material_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({entry.material.category})
                    </span>
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  Cantidad: <span className="font-medium">
                    {entry.quantity_received.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {entry.material?.unit_of_measure || 'kg'}
                  </span>
                </div>

                {entry.entered_by_user && (
                  <div className="text-xs text-gray-500">
                    Registrado por: {entry.entered_by_user.first_name} {entry.entered_by_user.last_name}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Pendiente
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}



