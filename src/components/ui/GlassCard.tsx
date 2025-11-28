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

  const Component = onClick || hover ? motion.div : 'div';
  const motionProps = onClick || hover ? {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98 },
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  } : {};

  return (
    <Component
      className={cn(
        baseClasses[variant],
        'rounded-2xl p-6 transition-all duration-300',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </Component>
  );
};
