'use client';

import { Suspense } from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import PlantSelectionGuard from '@/components/auth/PlantSelectionGuard';
import ConcreteMixCalculator from '@/components/calculator/ConcreteMixCalculator';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Loading component for the calculator
function CalculatorLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const { hasRole, isLoading } = useAuthBridge();

  const content = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50">
          <CalculatorLoading />
        </div>
      );
    }

    const allowed = hasRole(['QUALITY_TEAM', 'EXECUTIVE']);
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/recipes"
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Volver a Recetas
              </Link>
              <div className="border-l border-gray-300 h-6"></div>
              <h1 className="text-lg font-semibold text-gray-900">Calculadora de Mezclas</h1>
            </div>
            <div className="text-sm text-gray-500">Sistema integrado de diseño de mezclas</div>
          </div>
        </div>

        {/* Body */}
        {allowed ? (
          <Suspense fallback={<CalculatorLoading />}>
            <ConcreteMixCalculator />
          </Suspense>
        ) : (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="mb-6">
                  <Link
                    href="/recipes"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Recetas
                  </Link>
                </div>
                <div className="text-red-600 mb-4">
                  <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.067 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
                  <p className="text-gray-600">
                    Solo el equipo de calidad y ejecutivos pueden acceder a la calculadora de mezclas de concreto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PlantSelectionGuard requirePlant={true}>{content()}</PlantSelectionGuard>
  );
}