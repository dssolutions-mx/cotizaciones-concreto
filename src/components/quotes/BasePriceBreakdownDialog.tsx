'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { calculateBasePriceBreakdown } from '@/lib/utils/priceCalculator';
import type { DistanceCalculation } from '@/types/distance';
import { Loader2 } from 'lucide-react';

interface BasePriceBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeCode: string;
  basePrice: number;
  distanceInfo: DistanceCalculation | null;
}

export function BasePriceBreakdownDialog({
  open,
  onOpenChange,
  recipeId,
  recipeCode,
  basePrice,
  distanceInfo,
}: BasePriceBreakdownDialogProps) {
  const [breakdown, setBreakdown] = useState<{
    materialCost: number;
    administrativeCosts: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && recipeId) {
      loadBreakdown();
    }
  }, [open, recipeId]);

  const loadBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await calculateBasePriceBreakdown(recipeId);
      setBreakdown(result);
    } catch (err) {
      console.error('Error loading breakdown:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el desglose');
    } finally {
      setLoading(false);
    }
  };

  const transportCostPerM3 = distanceInfo?.transport_cost_per_m3 || 0;
  // The basePrice passed to this dialog already includes transport cost
  // breakdown.total = materials + administrative costs (without transport)
  // basePrice = materials + administrative + transport
  const basePriceWithoutTransport = breakdown ? breakdown.total : Math.max(0, basePrice - transportCostPerM3);
  const totalBasePrice = basePrice; // basePrice already includes transport

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Desglose del Precio Base</DialogTitle>
          <DialogDescription>
            Desglose detallado del precio base para {recipeCode}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Cargando desglose...</span>
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-red-600">{error}</div>
        ) : breakdown ? (
          <div className="space-y-4 py-4">
            {/* Material Cost */}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Costo de Materiales:</span>
              <span className="text-sm font-semibold text-gray-900">
                ${breakdown.materialCost.toFixed(2)}
              </span>
            </div>

            {/* Transport Cost */}
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="text-sm font-medium text-gray-700">Costo de Transporte:</span>
                {distanceInfo && (
                  <span className="ml-2 text-xs text-gray-500">
                    (Rango {distanceInfo.range_code}, {distanceInfo.distance_km.toFixed(2)} km)
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900">
                ${transportCostPerM3.toFixed(2)}/m³
              </span>
            </div>

            {/* Fixed Costs (Administrative) */}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Costos Fijos (Gastos Administrativos):</span>
              <span className="text-sm font-semibold text-gray-900">
                ${breakdown.administrativeCosts.toFixed(2)}/m³
              </span>
            </div>

            {/* Base Price Subtotal (without transport) */}
            <div className="flex justify-between items-center py-2 border-t-2 border-gray-300">
              <span className="text-sm font-medium text-gray-700">Subtotal (Materiales + Fijos):</span>
              <span className="text-sm font-semibold text-gray-900">
                ${basePriceWithoutTransport.toFixed(2)}/m³
              </span>
            </div>

            {/* Total Base Price (with transport) */}
            <div className="flex justify-between items-center py-3 border-t-2 border-primary bg-primary/5 rounded-lg px-3">
              <span className="text-base font-bold text-gray-900">Precio Base Total (con transporte):</span>
              <span className="text-base font-bold text-primary">
                ${totalBasePrice.toFixed(2)}/m³
              </span>
            </div>

            {/* Note */}
            <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
              <p className="mb-1">Nota: El precio base incluye:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Costo de materiales de la última variante</li>
                <li>Gastos administrativos por m³</li>
                <li>Costo de transporte según rango de distancia</li>
              </ul>
              <p className="mt-2">El margen se aplica sobre este precio base.</p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

