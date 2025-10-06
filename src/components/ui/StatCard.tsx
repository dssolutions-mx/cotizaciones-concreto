import { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ 
  label, 
  value, 
  change,
  icon,
  trend = 'neutral',
  className 
}: StatCardProps) {
  const trendColors: Record<'up' | 'down' | 'neutral', string> = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <Card variant="thick" className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <p className={cn('text-xs mt-2', trendColors[trend])}>
              {change > 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}


