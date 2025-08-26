'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  TrendingDown, 
  FileText, 
  Upload, 
  BarChart3, 
  Calendar,
  ArrowUpDown,
  Inbox,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'

export default function DosificadorDashboard() {
  const { profile } = useAuthSelectors()

  return (
    <div className="container mx-auto p-6">
      {/* Quick Navigation Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/inventory/entries">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Nueva Entrada</CardTitle>
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Registrar entrada de materiales al inventario
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/inventory/adjustments">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Nuevo Ajuste</CardTitle>
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Realizar ajustes manuales al inventario
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/inventory/daily-log">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Bitácora Diaria</CardTitle>
                  <FileText className="h-5 w-5 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Ver y gestionar la bitácora del día
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/arkik">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Procesador Arkik</CardTitle>
                  <Upload className="h-5 w-5 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Procesar archivos Excel de producción
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
