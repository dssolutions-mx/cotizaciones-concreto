'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-callout font-medium transition-all duration-300 whitespace-nowrap',
        active
          ? 'bg-blue-600 text-white border border-blue-700 ring-2 ring-blue-400/50'
          : 'glass-thin text-label-secondary hover:glass-thick hover:text-label-primary border border-transparent'
      )}
    >
      {label}
    </motion.button>
  );
}
