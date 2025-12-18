'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DistanceRangeConfig } from '@/types/distance';

interface RangeBreakdownProps {
  ranges: DistanceRangeConfig[];
  currentRangeCode?: string;
  currentDistance?: number;
}

export function RangeBreakdown({ ranges, currentRangeCode, currentDistance }: RangeBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (ranges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rangos de Distancia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No hay rangos configurados para esta planta
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedRanges = [...ranges].sort((a, b) => a.min_distance_km - b.min_distance_km);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-bold">Rangos de Distancia</CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8 p-0"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-3 pt-2">
            {sortedRanges.map((range) => {
            const isCurrent = range.range_code === currentRangeCode;
            const isInRange =
              currentDistance !== undefined &&
              currentDistance >= range.min_distance_km &&
              currentDistance < range.max_distance_km;

            return (
              <div
                key={range.id}
                className={`p-3 rounded-lg border ${
                  isCurrent || isInRange
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isCurrent || isInRange ? 'default' : 'outline'}
                      className="text-sm"
                    >
                      {range.range_code}
                    </Badge>
                    <span className="text-sm font-medium">
                      Bloque {range.bloque_number}
                    </span>
                  </div>
                  {(isCurrent || isInRange) && (
                    <Badge variant="secondary" className="text-xs">
                      Actual
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {range.min_distance_km} - {range.max_distance_km} km
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Transporte/m³:</span>
                    <span className="font-medium">
                      ${range.total_transport_per_m3.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Por viaje:</span>
                    <span className="font-medium">
                      ${range.total_per_trip.toFixed(2)}
                    </span>
                  </div>
                  {range.operator_bonus_per_trip > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Bono operador/viaje:</span>
                      <span className="font-medium text-blue-600">
                        ${range.operator_bonus_per_trip.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {(() => {
                    // Calculate diferencial as difference from lowest range
                    const sortedRanges = [...ranges].sort((a, b) => a.min_distance_km - b.min_distance_km);
                    const lowestRange = sortedRanges[0];
                    const diferencial = range.total_transport_per_m3 - (lowestRange?.total_transport_per_m3 || 0);
                    return diferencial > 0 ? (
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-muted-foreground">Diferencial (vs más bajo):</span>
                        <span className="font-medium text-orange-600">
                          ${diferencial.toFixed(2)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

