'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface ComplianceBadgeProps {
  value: number;
  status?: 'success' | 'warning' | 'error' | 'pending';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showPercentage?: boolean;
}

export function ComplianceBadge({ 
  value, 
  status, 
  size = 'md',
  showIcon = true,
  showPercentage = true
}: ComplianceBadgeProps) {
  // Auto-determine status based on value if not provided
  const badgeStatus = status || (value >= 95 ? 'success' : value >= 85 ? 'warning' : value >= 0 ? 'error' : 'pending');
  
  const getStatusConfig = () => {
    switch (badgeStatus) {
      case 'success':
        return {
          icon: CheckCircle2,
          bgColor: 'bg-systemGreen/10 dark:bg-systemGreen/20',
          textColor: 'text-systemGreen',
          borderColor: 'border-systemGreen/30',
          label: 'Cumple'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-systemOrange/10 dark:bg-systemOrange/20',
          textColor: 'text-systemOrange',
          borderColor: 'border-systemOrange/30',
          label: 'Aceptable'
        };
      case 'error':
        return {
          icon: XCircle,
          bgColor: 'bg-systemRed/10 dark:bg-systemRed/20',
          textColor: 'text-systemRed',
          borderColor: 'border-systemRed/30',
          label: 'No Cumple'
        };
      case 'pending':
        return {
          icon: Clock,
          bgColor: 'bg-systemBlue/10 dark:bg-systemBlue/20',
          textColor: 'text-systemBlue',
          borderColor: 'border-systemBlue/30',
          label: 'Pendiente'
        };
      default:
        return {
          icon: Clock,
          bgColor: 'bg-gray-500/10',
          textColor: 'text-gray-500',
          borderColor: 'border-gray-500/30',
          label: 'N/A'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-caption gap-1',
    md: 'px-3 py-1 text-footnote gap-1.5',
    lg: 'px-4 py-1.5 text-callout gap-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]}
        ${config.bgColor}
        ${config.textColor}
        border ${config.borderColor}
        rounded-full
        font-medium
        transition-all duration-200
      `}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showPercentage && value >= 0 && (
        <span>{value.toFixed(0)}%</span>
      )}
      {!showPercentage && <span>{config.label}</span>}
    </motion.div>
  );
}

export default ComplianceBadge;

