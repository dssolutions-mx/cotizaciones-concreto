'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassDashboardLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export const GlassDashboardLayout: React.FC<GlassDashboardLayoutProps> = ({
  children,
  header,
  className
}) => {
  return (
    <div className={cn('min-h-screen bg-gray-100 dark:bg-gray-900', className)}>
      {/* Floating Header */}
      {header && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6"
        >
          <div className="container mx-auto px-4 py-4">
            {header}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};
