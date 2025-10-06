'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface QuickActionProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

const colorMap = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600'
};

export function QuickAction({ icon, label, onClick, color = 'blue' }: QuickActionProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-4 rounded-2xl glass-interactive"
    >
      <div className={cn(
        'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg',
        colorMap[color]
      )}>
        {icon}
      </div>
      <span className="text-footnote font-medium text-gray-700">
        {label}
      </span>
    </motion.button>
  );
}
