'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses = {
  blue: 'bg-systemBlue',
  green: 'bg-systemGreen',
  purple: 'bg-systemBlue', // Use systemBlue instead of purple
  orange: 'bg-systemOrange',
  red: 'bg-systemRed'
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  color = 'blue',
  size = 'md',
  className
}) => {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeMax = typeof max === 'number' && !isNaN(max) && max > 0 ? max : 100;
  const percentage = Math.min(Math.max((safeValue / safeMax) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {safeValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {safeMax.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700', sizeClasses[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            colorClasses[color],
            'shadow-sm'
          )}
        />
      </div>
    </div>
  );
};
