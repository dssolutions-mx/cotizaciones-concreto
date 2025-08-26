'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUp, Upload, AlertCircle } from 'lucide-react'

export default function ArkikUploadPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Carga de Archivos Arkik
        </h1>
        <p className="text-gray-600 mt-1">
          Suba archivos de consumo Arkik para procesamiento automático
        </p>
      </div>

      {/* Upload Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Subir Archivo Arkik
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Upload className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Funcionalidad en Desarrollo
            </h3>
            <p className="text-gray-500 mb-4">
              La interfaz de carga Arkik será implementada en la siguiente fase
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span>Componente pendiente de implementación</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
