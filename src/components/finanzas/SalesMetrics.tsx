'use client';

import { Beaker, FileCheck, DollarSign, Pipette } from 'lucide-react';
import { usePlantAwareDailySales } from '@/hooks/usePlantAwareDailySales';
import KPICard from '@/components/finanzas/KPICard';
import { formatCurrency } from '@/lib/utils';

interface SalesMetricsProps {
  date: string;
}

export function SalesMetrics({ date }: SalesMetricsProps) {
  const { salesData, isLoading, error, currentPlant } = usePlantAwareDailySales({ date });

  if (isLoading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Diarias</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-full border-s-4 border-s-gray-300 rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-row items-center justify-between space-y-0 pb-1 p-6">
                <div className="text-sm font-medium">Cargando...</div>
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold mb-1">--</div>
                <p className="text-xs text-muted-foreground">Cargando datos...</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Diarias</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
          <h3 className="font-semibold mb-1">Error al cargar los datos</h3>
          <p className="text-sm">Por favor, intente más tarde o contacte a soporte.</p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">
              {error}
            </pre>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Entregadas</h2>
      {currentPlant && (
        <div className="mb-4 text-sm text-muted-foreground">
          Filtrando por: <span className="font-medium">{currentPlant.name}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Concrete Volume */}
        <KPICard
          title="Volumen de Concreto Entregado"
          value={`${salesData.totalConcreteVolume.toFixed(2)} m³`}
          description={`${salesData.totalOrders} órdenes entregadas${salesData.emptyTruckVolume ? ` · Vacío: ${salesData.emptyTruckVolume.toFixed(2)} m³ (no incluido)` : ''}`}
          icon={<Beaker className="h-5 w-5 text-blue-500" />}
          className="border-s-4 border-s-blue-500"
        />
        
        {/* Pumping Volume */}
        <KPICard
          title="Volumen de Bombeo Entregado"
          value={`${salesData.totalPumpingVolume.toFixed(2)} m³`}
          description="Servicios de bombeo realizados"
          icon={<Pipette className="h-5 w-5 text-purple-500" />}
          className="border-s-4 border-s-purple-500"
        />
        
        {/* Subtotal */}
        <KPICard
          title="Subtotal"
          value={formatCurrency(salesData.totalSubtotal)}
          description="Monto antes de impuestos"
          icon={<FileCheck className="h-5 w-5 text-green-500" />}
          className="border-s-4 border-s-green-500"
        />
        
        {/* Total with VAT */}
        <KPICard
          title="Total con IVA"
          value={formatCurrency(salesData.totalWithVAT)}
          description="Monto total incluidos impuestos"
          icon={<DollarSign className="h-5 w-5 text-red-500" />}
          className="border-s-4 border-s-red-500"
        />
      </div>
    </section>
  );
}
