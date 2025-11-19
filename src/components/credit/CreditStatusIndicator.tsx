'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CreditStatus } from '@/lib/supabase/creditTerms';

interface CreditStatusIndicatorProps {
  creditStatus: CreditStatus;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function CreditStatusIndicator({
  creditStatus,
  showDetails = true,
  size = 'md',
}: CreditStatusIndicatorProps) {
  const {
    credit_limit,
    current_balance,
    credit_available,
    utilization_percentage,
    status,
    has_terms,
  } = creditStatus;

  // Size configurations
  const sizeConfig = {
    sm: {
      gauge: 80,
      strokeWidth: 6,
      fontSize: 'text-lg',
      iconSize: 'h-4 w-4',
    },
    md: {
      gauge: 120,
      strokeWidth: 8,
      fontSize: 'text-2xl',
      iconSize: 'h-5 w-5',
    },
    lg: {
      gauge: 160,
      strokeWidth: 10,
      fontSize: 'text-3xl',
      iconSize: 'h-6 w-6',
    },
  };

  const config = sizeConfig[size];

  // Calculate gauge dimensions
  const gaugeSize = config.gauge;
  const strokeWidth = config.strokeWidth;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (utilization_percentage / 100) * circumference;

  // Color schemes based on status
  const statusColors = {
    healthy: {
      primary: '#34C759', // Green
      bg: '#E8F5E9',
      text: 'text-green-700',
      ring: 'ring-green-500',
      icon: CheckCircle,
      label: 'Saludable',
    },
    warning: {
      primary: '#FF9500', // Orange
      bg: '#FFF3E0',
      text: 'text-orange-700',
      ring: 'ring-orange-500',
      icon: AlertCircle,
      label: 'Advertencia',
    },
    critical: {
      primary: '#FF3B30', // Red
      bg: '#FFEBEE',
      text: 'text-red-700',
      ring: 'ring-red-500',
      icon: AlertCircle,
      label: 'Crítico',
    },
    over_limit: {
      primary: '#8B0000', // Dark Red
      bg: '#FFCDD2',
      text: 'text-red-900',
      ring: 'ring-red-700',
      icon: XCircle,
      label: 'Sobre el Límite',
    },
  };

  const colorScheme = statusColors[status];
  const StatusIcon = colorScheme.icon;

  if (!has_terms) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center">
            No se han configurado términos de crédito
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <StatusIcon className={`${config.iconSize} ${colorScheme.text}`} />
          Estado de Crédito
        </CardTitle>
        <CardDescription>{colorScheme.label}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center">
        {/* Circular Gauge */}
        <div className="relative mb-4" style={{ width: gaugeSize, height: gaugeSize }}>
          {/* Background Circle */}
          <svg
            width={gaugeSize}
            height={gaugeSize}
            className="transform -rotate-90"
          >
            <circle
              cx={gaugeSize / 2}
              cy={gaugeSize / 2}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress Circle */}
            <circle
              cx={gaugeSize / 2}
              cy={gaugeSize / 2}
              r={radius}
              stroke={colorScheme.primary}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          </svg>

          {/* Percentage Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-bold ${config.fontSize} ${colorScheme.text}`}>
              {Math.round(utilization_percentage)}%
            </span>
            <span className="text-xs text-muted-foreground">Utilizado</span>
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="w-full space-y-3 mt-2">
            {/* Credit Limit */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">
                Límite de Crédito
              </span>
              <span className="text-sm font-bold text-foreground">
                {formatCurrency(credit_limit)}
              </span>
            </div>

            {/* Current Balance */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">
                Saldo Actual
              </span>
              <span className={`text-sm font-bold ${colorScheme.text}`}>
                {formatCurrency(current_balance)}
              </span>
            </div>

            {/* Available Credit */}
            <div
              className="flex justify-between items-center p-3 rounded-lg"
              style={{ backgroundColor: colorScheme.bg }}
            >
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {credit_available > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                Crédito Disponible
              </span>
              <span className={`text-sm font-bold ${colorScheme.text}`}>
                {formatCurrency(credit_available)}
              </span>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center pt-2">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${colorScheme.text}`}
                style={{ backgroundColor: colorScheme.bg }}
              >
                <StatusIcon className="h-4 w-4" />
                {colorScheme.label}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
