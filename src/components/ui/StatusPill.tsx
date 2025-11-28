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
    bg: 'bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    glow: 'shadow-blue-500/50'
  },
  validated: {
    bg: 'bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    glow: 'shadow-green-500/50'
  },
  scheduled: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    glow: 'shadow-purple-500/50'
  },
  completed: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    glow: 'shadow-emerald-500/50'
  },
  cancelled: {
    bg: 'bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    glow: 'shadow-red-500/50'
  },
  pending: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    glow: 'shadow-yellow-500/50'
  },
  approved: {
    bg: 'bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    glow: 'shadow-green-500/50'
  },
  rejected: {
    bg: 'bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    glow: 'shadow-red-500/50'
  }
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base'
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  variant = 'glow',
  size = 'md',
  className
}) => {
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
        'border border-current/20',
        className
      )}
    >
      {status}
    </motion.span>
  );
};
