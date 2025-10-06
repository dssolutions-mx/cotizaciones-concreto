'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'blue' | 'green' | 'orange' | 'purple';
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: 'from-slate-100/50 to-slate-200/30',
    icon: 'bg-slate-100 text-slate-700',
    trend: 'text-slate-700'
  },
  green: {
    bg: 'from-slate-100/50 to-slate-200/30',
    icon: 'bg-slate-100 text-slate-700',
    trend: 'text-slate-700'
  },
  orange: {
    bg: 'from-slate-100/50 to-slate-200/30',
    icon: 'bg-slate-100 text-slate-700',
    trend: 'text-slate-700'
  },
  purple: {
    bg: 'from-slate-100/50 to-slate-200/30',
    icon: 'bg-slate-100 text-slate-700',
    trend: 'text-slate-700'
  }
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  onClick
}: MetricCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'glass-thick rounded-3xl p-6 cursor-pointer relative overflow-hidden border border-slate-200',
        onClick && 'hover:shadow-lg hover:border-slate-300'
      )}
    >
      {/* Gradient Background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40', colors.bg)} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colors.icon)}>
            {icon}
          </div>
          {trend && (
            <div className={cn('text-right', colors.trend)}>
              <div className="text-title-3 font-bold">
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </div>
              <div className="text-caption text-gray-500">{trend.label}</div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-footnote text-gray-500 uppercase tracking-wide font-medium">
            {title}
          </h3>
          <p className="text-title-1 font-bold text-gray-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-callout text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
