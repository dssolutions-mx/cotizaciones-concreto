'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: string;
  variant?: 'default' | 'glow' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusColors: Record<string, { bg: string; text: string; glow: string }> = {
  created: {
    bg: 'bg-systemBlue/20',
    text: 'text-systemBlue dark:text-systemBlue/80',
    glow: 'shadow-systemBlue/50'
  },
  validated: {
    bg: 'bg-systemGreen/20',
    text: 'text-systemGreen dark:text-systemGreen/80',
    glow: 'shadow-systemGreen/50'
  },
  scheduled: {
    bg: 'bg-systemOrange/20',
    text: 'text-systemOrange dark:text-systemOrange/80',
    glow: 'shadow-systemOrange/50'
  },
  completed: {
    bg: 'bg-systemGreen/20',
    text: 'text-systemGreen dark:text-systemGreen/80',
    glow: 'shadow-systemGreen/50'
  },
  cancelled: {
    bg: 'bg-systemRed/20',
    text: 'text-systemRed dark:text-systemRed/80',
    glow: 'shadow-systemRed/50'
  },
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300 font-bold',
    glow: 'shadow-amber-500/40'
  },
  pending_approval: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300 font-bold',
    glow: 'shadow-amber-500/40'
  },
  approved: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300 font-bold',
    glow: 'shadow-green-500/40'
  },
  rejected: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300 font-bold',
    glow: 'shadow-red-500/40'
  },
  rejected_by_validator: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300 font-bold',
    glow: 'shadow-red-500/40'
  }
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base'
};

const translateStatus = (status: string): string => {
  if (!status) return 'Sin estado';
  const statusMap: Record<string, string> = {
    'created': 'Creada',
    'validated': 'Validada',
    'scheduled': 'Programada',
    'completed': 'Completada',
    'cancelled': 'Cancelada',
    'pending': 'Pendiente',
    'pending_approval': 'Pendiente de Aprobación',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'rejected_by_validator': 'Rechazado por Validador'
  };
  return statusMap[status.toLowerCase()] || status;
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  variant = 'glow',
  size = 'md',
  className
}) => {
  if (!status) return null;
  
  const statusKey = status.toLowerCase();
  const colors = statusColors[statusKey] || {
    bg: 'bg-gray-500/20',
    text: 'text-gray-700 dark:text-gray-300',
    glow: 'shadow-gray-500/50'
  };

  const glowEffect = variant === 'glow' ? `shadow-lg ${colors.glow}` : '';
  const subtleEffect = variant === 'subtle' ? 'glass-thin' : '';

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        sizeClasses[size],
        colors.bg,
        colors.text,
        variant === 'glow' && glowEffect,
        variant === 'subtle' && subtleEffect,
        (['approved', 'rejected', 'rejected_by_validator', 'pending', 'pending_approval'].includes(statusKey)
          ? (statusKey === 'approved' ? 'border-2 border-green-500' : statusKey === 'pending' || statusKey === 'pending_approval' ? 'border-2 border-amber-500' : 'border-2 border-red-500')
          : 'border border-current/20'),
        className
      )}
    >
      {translateStatus(status)}
    </motion.span>
  );
};
