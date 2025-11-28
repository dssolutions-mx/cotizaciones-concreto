'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingDockProps {
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  floating?: boolean;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  children,
  className,
  position = 'top',
  floating = true
}) => {
  const positionClasses = {
    top: 'top-4 left-1/2 -translate-x-1/2',
    bottom: 'bottom-4 left-1/2 -translate-x-1/2',
    left: 'left-4 top-1/2 -translate-y-1/2',
    right: 'right-4 top-1/2 -translate-y-1/2'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        floating && 'fixed z-50',
        positionClasses[position],
        'glass-thick rounded-2xl shadow-2xl',
        className
      )}
    >
      {children}
    </motion.div>
  );
};
