'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'

export default function AdvancedDashboardTestPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard Avanzado de Inventario
        </h1>
        <p className="text-gray-600">
          Sistema de análisis integral de inventario - Prueba de integración
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Componentes Implementados
            </CardTitle>
            <CardDescription>
              Verificación de componentes del dashboard avanzado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>API Endpoint</span>
              <Badge variant="default">✅ Implementado</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Servicio de Dashboard</span>
              <Badge variant="default">✅ Implementado</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Hook de Estado</span>
              <Badge variant="default">✅ Implementado</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Componentes UI</span>
              <Badge variant="default">✅ Implementado</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Tipos TypeScript</span>
              <Badge variant="default">✅ Implementado</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Funcionalidades Clave
            </CardTitle>
            <CardDescription>
              Características principales del dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Análisis de rango de fechas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Cálculo de inventario teórico</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Análisis de varianzas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Integración con remisiones</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Exportación de datos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Instrucciones de Prueba
          </CardTitle>
          <CardDescription>
            Pasos para probar el dashboard avanzado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Acceso al Dashboard</h4>
            <p className="text-sm text-gray-600">
              Navega a "Dashboard Avanzado" en el menú lateral del módulo de inventario.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Configuración de Fechas</h4>
            <p className="text-sm text-gray-600">
              Selecciona un rango de fechas para analizar (máximo 90 días).
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Revisión de Datos</h4>
            <p className="text-sm text-gray-600">
              Verifica que los datos de materiales, remisiones y ajustes se muestren correctamente.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">4. Análisis de Varianzas</h4>
            <p className="text-sm text-gray-600">
              Revisa los materiales con varianzas significativas (≥1% o ≥5%).
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">5. Exportación</h4>
            <p className="text-sm text-gray-600">
              Prueba la funcionalidad de exportación CSV.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        <Link href="/production-control/advanced-dashboard">
          <Button>
            Ir al Dashboard Avanzado
          </Button>
        </Link>
        <Link href="/production-control">
          <Button variant="outline">
            Volver al Dashboard Principal
          </Button>
        </Link>
      </div>
    </div>
  )
}
