'use client';

import React from 'react';
import { AlertTriangle, Beaker } from 'lucide-react';
import Link from 'next/link';

interface PlantRestrictedAccessProps {
  plantCode: string;
  sectionName: string;
}

export default function PlantRestrictedAccess({ plantCode, sectionName }: PlantRestrictedAccessProps) {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-3xl mx-auto bg-orange-50 border border-orange-300 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-orange-600" />
          <h2 className="text-2xl font-semibold text-orange-800">Acceso Restringido por Planta</h2>
        </div>
        
        <p className="text-lg mb-4 text-orange-700">
          No tienes acceso a {sectionName} en la planta {plantCode}.
        </p>
        
        <div className="bg-white p-4 rounded-lg border border-orange-200 mb-4">
          <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
          <p className="text-gray-600">
            Los usuarios del equipo de calidad en las plantas P002, P003 y P004 tienen acceso 
            limitado solo a Muestreos, Ensayos y Materiales.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link 
            href="/quality/muestreos"
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Beaker className="h-4 w-4 mr-2" />
            Ir a Muestreos
          </Link>
          <Link 
            href="/quality/ensayos"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Ir a Ensayos
          </Link>
        </div>
      </div>
    </div>
  );
}
