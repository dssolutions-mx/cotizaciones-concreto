'use client';

import React from 'react';
import ArkikProcessor from '@/components/arkik/ArkikProcessor';

export default function ArkikPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Procesador Arkik
          </h1>
          <p className="text-lg text-gray-600">
            Procesa archivos Excel de producción de concreto
          </p>
        </div>
      </div>

      {/* Main Processor */}
      <ArkikProcessor />
    </div>
  );
}


