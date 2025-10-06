'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ActivityCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'warning' | 'info' | 'error' | 'pending';
  onClick?: () => void;
}

const statusColors = {
  success: 'bg-green-500/20 text-green-600',
  warning: 'bg-orange-500/20 text-orange-600',
  info: 'bg-blue-500/20 text-blue-600',
  error: 'bg-red-500/20 text-red-600',
  pending: 'bg-gray-500/20 text-gray-600'
};

export function ActivityCard({
  icon,
  title,
  description,
  timestamp,
  status = 'info',
  onClick
}: ActivityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        'glass-thin rounded-2xl p-4 cursor-pointer flex items-start gap-4',
        'hover:glass-thick transition-all duration-300'
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', statusColors[status])}>
        {icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-body font-semibold text-gray-900 truncate">
          {title}
        </h4>
        <p className="text-callout text-gray-600 line-clamp-2 mt-1">
          {description}
        </p>
        <p className="text-caption text-gray-400 mt-2">
          {timestamp}
        </p>
      </div>
    </motion.div>
  );
}
