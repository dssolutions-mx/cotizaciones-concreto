'use client'

import React, { useState, useEffect, useRef } from 'react'
// Using a simpler search implementation without Command component
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Search, Package, TrendingDown, FileText, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SearchResult {
  id: string
  type: 'entry' | 'adjustment' | 'material'
  title: string
  subtitle?: string
  date?: string
  href: string
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Search when term changes
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([])
      return
    }

    const search = async () => {
      setLoading(true)
      try {
        // Search entries - using date range to get recent entries, then filter client-side
        const entriesResponse = await fetch(`/api/inventory/entries?limit=50`)
        const entriesData = entriesResponse.ok ? await entriesResponse.json() : { entries: [] }

        // Search adjustments - using date range to get recent adjustments, then filter client-side
        const adjustmentsResponse = await fetch(`/api/inventory/adjustments?limit=50`)
        const adjustmentsData = adjustmentsResponse.ok ? await adjustmentsResponse.json() : { adjustments: [] }

        // Filter client-side by search term
        const searchLower = searchTerm.toLowerCase()
        const filteredEntries = entriesData.entries?.filter((entry: any) => {
          const entryNumber = entry.entry_number?.toLowerCase() || ''
          const materialName = entry.materials?.material_name?.toLowerCase() || ''
          const supplierName = entry.suppliers?.name?.toLowerCase() || ''
          return entryNumber.includes(searchLower) || materialName.includes(searchLower) || supplierName.includes(searchLower)
        }).slice(0, 5) || []

        const filteredAdjustments = adjustmentsData.adjustments?.filter((adjustment: any) => {
          const adjustmentNumber = adjustment.adjustment_number?.toLowerCase() || ''
          const materialName = adjustment.materials?.material_name?.toLowerCase() || ''
          const notes = adjustment.reference_notes?.toLowerCase() || ''
          return adjustmentNumber.includes(searchLower) || materialName.includes(searchLower) || notes.includes(searchLower)
        }).slice(0, 5) || []

        const searchResults: SearchResult[] = []

        // Add filtered entries
        filteredEntries.forEach((entry: any) => {
          searchResults.push({
            id: entry.id,
            type: 'entry',
            title: entry.entry_number || `Entrada #${entry.id}`,
            subtitle: entry.materials?.material_name || 'Material',
            date: entry.entry_date,
            href: `/production-control/entries`
          })
        })

        // Add filtered adjustments
        filteredAdjustments.forEach((adjustment: any) => {
          searchResults.push({
            id: adjustment.id,
            type: 'adjustment',
            title: adjustment.adjustment_number || `Ajuste #${adjustment.id}`,
            subtitle: adjustment.materials?.material_name || 'Material',
            date: adjustment.adjustment_date,
            href: `/production-control/adjustments`
          })
        })

        setResults(searchResults.slice(0, 10))
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const handleSelect = (href: string) => {
    router.push(href)
    setOpen(false)
    setSearchTerm('')
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return Package
      case 'adjustment':
        return TrendingDown
      default:
        return FileText
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrada'
      case 'adjustment':
        return 'Ajuste'
      default:
        return 'Registro'
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full sm:w-[300px] justify-start text-left font-normal h-9",
            "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Buscar entradas, ajustes...</span>
          <span className="sm:hidden">Buscar...</span>
          <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar entradas, ajustes, materiales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-8 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          ) : results.length === 0 && searchTerm.length >= 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No se encontraron resultados.
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Escriba al menos 2 caracteres para buscar
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Resultados
              </div>
              {results.map((result) => {
                const Icon = getIcon(result.type)
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result.href)}
                    className="w-full flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{result.title}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      )}
                      {result.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(result.date), 'dd MMM yyyy', { locale: es })}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
