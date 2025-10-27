'use client';

import React from 'react';

export const runtime = 'nodejs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DatabaseDiagnostic from '@/components/quality/caracterizacion/DatabaseDiagnostic';
import TestCaracterizacion from '@/components/quality/caracterizacion/TestCaracterizacion';
import TestFormFlow from '@/components/quality/caracterizacion/TestFormFlow';

export default function DiagnosticoPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Diagnóstico de Caracterización de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Verificación del estado de las tablas de base de datos
            </p>
          </div>
          <Link href="/quality/caracterizacion-materiales">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al Histórico
            </Button>
          </Link>
        </div>

        {/* Diagnóstico */}
        <DatabaseDiagnostic />

        {/* Prueba de Flujo Completo */}
        <TestFormFlow />

        {/* Pruebas de Integración */}
        <TestCaracterizacion />
      </div>
    </div>
  );
}
