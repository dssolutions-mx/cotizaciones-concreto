'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  variant?: 'thick' | 'thin' | 'base' | 'interactive';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  onClick,
  hover = false,
  variant = 'thick'
}) => {
  const baseClasses = {
    thick: 'glass-thick',
    thin: 'glass-thin',
    base: 'glass-base',
    interactive: 'glass-interactive'
  };

  if (onClick || hover) {
    return (
      <motion.div
        className={cn(
          baseClasses[variant],
          'rounded-2xl transition-all duration-300',
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
        whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
        whileTap={onClick ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        baseClasses[variant],
        'rounded-2xl transition-all duration-300',
        className
      )}
    >
      {children}
    </div>
  );
};
