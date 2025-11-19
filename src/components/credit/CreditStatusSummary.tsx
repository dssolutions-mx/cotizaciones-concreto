'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditStatus } from '@/lib/supabase/creditTerms';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, AlertCircle, CheckCircle2, Settings } from 'lucide-react';

interface CreditStatusSummaryProps {
  creditStatus: CreditStatus;
  onConfigureClick?: () => void;
  canEdit?: boolean;
}

export default function CreditStatusSummary({
  creditStatus,
  onConfigureClick,
  canEdit = false,
}: CreditStatusSummaryProps) {
  const {
    has_terms,
    credit_limit,
    current_balance,
    credit_available,
    utilization_percentage,
    status,
    last_payment_date,
    days_since_last_payment
  } = creditStatus;

  // Determine color scheme based on status
  const getStatusColor = () => {
    if (!has_terms) return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
    switch (status) {
      case 'healthy':
        return { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' };
      case 'warning':
        return { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' };
      case 'critical':
        return { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' };
      case 'over_limit':
        return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
    }
  };

  const getStatusLabel = () => {
    if (!has_terms) return 'Sin Configurar';
    switch (status) {
      case 'healthy': return 'Saludable';
      case 'warning': return 'Precaución';
      case 'critical': return 'Crítico';
      case 'over_limit': return 'Sobre Límite';
      default: return 'Desconocido';
    }
  };

  const getStatusIcon = () => {
    if (!has_terms) return AlertCircle;
    switch (status) {
      case 'healthy': return CheckCircle2;
      case 'warning': return AlertCircle;
      case 'critical': return AlertCircle;
      case 'over_limit': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const colors = getStatusColor();
  const StatusIcon = getStatusIcon();

  if (!has_terms) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50">
        <CardContent className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Settings className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Crédito No Configurado
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Este cliente no tiene términos de crédito establecidos. Configura el límite y condiciones para comenzar el seguimiento.
            </p>
            {canEdit && (
              <Button onClick={onConfigureClick} size="lg" className="gap-2">
                <Settings className="h-5 w-5" />
                Configurar Crédito
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate circle progress (0-100)
  const circleProgress = Math.min(utilization_percentage, 100);
  const circumference = 2 * Math.PI * 58; // radius of 58
  const strokeDashoffset = circumference - (circleProgress / 100) * circumference;

  return (
    <Card className={`border-2 shadow-lg ${colors.bg} border-${colors.dot.split('-')[1]}-200`}>
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">Estado de Crédito</h2>
              <Badge className={`${colors.bg} ${colors.text} border-0 px-3 py-1`}>
                <span className={`inline-block w-2 h-2 rounded-full ${colors.dot} mr-2`} />
                {getStatusLabel()}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              Actualizado {days_since_last_payment !== null ? `hace ${days_since_last_payment} días` : 'recientemente'}
            </p>
          </div>
          {canEdit && (
            <Button onClick={onConfigureClick} variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Ajustar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Circular Progress */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <svg width="140" height="140" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="none"
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={`${colors.text.replace('text', 'text')} transition-all duration-1000 ease-out`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <StatusIcon className={`h-8 w-8 ${colors.text} mb-1`} />
                <span className="text-3xl font-bold text-gray-900">
                  {Math.round(utilization_percentage)}%
                </span>
                <span className="text-xs text-gray-600">Utilización</span>
              </div>
            </div>
          </div>

          {/* Middle: Credit Stats */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Límite de Crédito</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(credit_limit)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Saldo Actual</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(current_balance)}</p>
            </div>
          </div>

          {/* Right: Available Credit (Hero) */}
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl p-6 shadow-sm">
            <TrendingUp className={`h-8 w-8 ${colors.text} mb-2`} />
            <p className="text-sm text-gray-600 mb-2">Disponible</p>
            <p className={`text-4xl font-bold ${credit_available > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(credit_available)}
            </p>
            {credit_available < 0 && (
              <p className="text-xs text-red-600 mt-2">
                Sobre el límite por {formatCurrency(Math.abs(credit_available))}
              </p>
            )}
          </div>
        </div>

        {/* Payment Status Bar */}
        {last_payment_date && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Último Pago:</span>
                <span className="font-medium text-gray-900">
                  {new Date(last_payment_date).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {days_since_last_payment !== null && days_since_last_payment <= 30 ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Al corriente
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Verificar pagos
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
