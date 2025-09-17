'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface CardItem {
  id: string;
  strength: number;
  volume: number;
  percentage: number;
  remisiones: number;
  recipe_code: string;
}

interface Props {
  items: CardItem[];
}

export function VolumeByStrengthCards({ items }: Props) {
  if (!items || items.length === 0) return null;

  const getColorClasses = (percentage: number, index: number) => {
    if (index === 0) {
      return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-500' };
    } else if (percentage > 20) {
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', accent: 'bg-green-500' };
    } else if (percentage > 10) {
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-500' };
    }
    return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', accent: 'bg-gray-500' };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((card, index) => {
        const colors = getColorClasses(card.percentage, index);
        return (
          <div key={card.id} className={`relative p-4 rounded-lg border-2 ${colors.bg} ${colors.border} transition-all hover:shadow-md`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
              <div className={`h-full ${colors.accent} transition-all duration-500`} style={{ width: `${card.percentage}%` }} />
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className={`${colors.text} border-current`}>
                  {card.strength} kg/cm²
                </Badge>
                <div className="text-xs text-muted-foreground font-mono">{card.recipe_code}</div>
              </div>
              {index === 0 && (
                <div className="flex items-center text-xs text-blue-600 font-medium">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Mayor
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${colors.text}`}>{card.percentage.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">{card.volume.toFixed(1)} m³</div>
              <div className="text-xs text-muted-foreground">{card.remisiones} remisiones</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


