'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface QualityMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  delay?: number;
  tooltip?: string;
}

export function QualityMetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'primary',
  delay = 0,
  tooltip
}: QualityMetricCardProps) {
  const colorConfig = {
    primary: {
      bg: 'from-systemBlue/20 to-systemBlue/5',
      icon: 'text-systemBlue',
      border: 'border-systemBlue/20'
    },
    success: {
      bg: 'from-systemGreen/20 to-systemGreen/5',
      icon: 'text-systemGreen',
      border: 'border-systemGreen/20'
    },
    warning: {
      bg: 'from-systemOrange/20 to-systemOrange/5',
      icon: 'text-systemOrange',
      border: 'border-systemOrange/20'
    },
    danger: {
      bg: 'from-systemRed/20 to-systemRed/5',
      icon: 'text-systemRed',
      border: 'border-systemRed/20'
    },
    info: {
      bg: 'from-systemPurple/20 to-systemPurple/5',
      icon: 'text-systemPurple',
      border: 'border-systemPurple/20'
    }
  };

  const config = colorConfig[color];

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-systemGreen" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-systemRed" />;
      case 'neutral':
        return <Minus className="w-4 h-4 text-label-tertiary" />;
      default:
        return null;
    }
  };

  const CardBody = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`
        glass-thick 
        rounded-3xl 
        p-6
        border
        ${config.border}
        bg-gradient-to-br ${config.bg}
        transition-all duration-200
        hover:shadow-lg
        relative
        overflow-hidden
      `}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl" />
      
      <div className="relative">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-2xl glass-thin ${config.icon}`}>
            {icon}
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {getTrendIcon()}
              {trendValue !== undefined && (
                <span className={`text-caption font-medium ${
                  trend === 'up' ? 'text-systemGreen' : 
                  trend === 'down' ? 'text-systemRed' : 
                  'text-label-tertiary'
                }`}>
                  {trendValue > 0 ? '+' : ''}{trendValue}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-2">
          <h3 className="text-title-1 font-bold text-label-primary mb-1">
            {value}
          </h3>
          <p className="text-callout font-medium text-label-secondary">
            {title}
          </p>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-footnote text-label-tertiary">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {CardBody}
        </TooltipTrigger>
        <TooltipContent sideOffset={6} className="max-w-xs glass-thick border border-white/20 text-left">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return CardBody;
}

export default QualityMetricCard;

