'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, AlertCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PaymentComplianceInfo } from '@/lib/supabase/creditTerms';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface PaymentComplianceViewProps {
  complianceInfo: PaymentComplianceInfo;
}

export default function PaymentComplianceView({
  complianceInfo,
}: PaymentComplianceViewProps) {
  const {
    current_balance,
    last_payment_date,
    expected_frequency_days,
    days_since_last_payment,
    is_overdue,
    days_overdue,
    next_expected_payment,
    compliance_status,
    has_outstanding_balance,
  } = complianceInfo;

  // Compliance status configuration
  const statusConfig = {
    on_track: {
      label: 'Al Corriente',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: CheckCircle,
      description: 'Los pagos están al día',
    },
    approaching_due: {
      label: 'Próximo a Vencer',
      color: 'text-orange-700',
      bg: 'bg-orange-100',
      icon: Clock,
      description: 'Se acerca la fecha de pago',
    },
    overdue: {
      label: 'Vencido',
      color: 'text-red-700',
      bg: 'bg-red-100',
      icon: AlertCircle,
      description: 'Pago vencido',
    },
    in_credit: {
      label: 'En Crédito',
      color: 'text-blue-700',
      bg: 'bg-blue-100',
      icon: DollarSign,
      description: 'Cliente tiene crédito disponible (sin deuda pendiente)',
    },
    current: {
      label: 'Al Día',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: CheckCircle,
      description: 'Sin saldo pendiente',
    },
    no_terms: {
      label: 'Sin Términos',
      color: 'text-gray-700',
      bg: 'bg-gray-100',
      icon: AlertCircle,
      description: 'No hay términos de pago configurados',
    },
  };

  const config = statusConfig[compliance_status];
  const Icon = config.icon;

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!expected_frequency_days || !days_since_last_payment) return 0;

    const percentage = (days_since_last_payment / expected_frequency_days) * 100;
    return Math.min(percentage, 100);
  };

  const progressPercentage = getProgressPercentage();

  if (compliance_status === 'no_terms') {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Cumplimiento de Pagos
          </CardTitle>
          <CardDescription>Estado de los pagos del cliente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay términos de pago configurados para este cliente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Cumplimiento de Pagos
            </CardTitle>
            <CardDescription>Estado de los pagos del cliente</CardDescription>
          </div>
          <Badge className={`${config.bg} ${config.color} flex items-center gap-2 px-3 py-1`}>
            <Icon className="h-4 w-4" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Balance Display */}
        <div className="p-4 bg-muted rounded-lg border-2">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-muted-foreground">
              Saldo Actual
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              current_balance < 0
                ? 'text-green-600'
                : current_balance > 0
                ? 'text-red-600'
                : 'text-foreground'
            }`}
          >
            {formatCurrency(Math.abs(current_balance))}
          </p>
          {current_balance < 0 && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              Cliente tiene crédito disponible
            </p>
          )}
          {current_balance > 0 && (
            <p className="text-xs text-red-600 mt-1 font-medium">
              Saldo pendiente por cobrar
            </p>
          )}
          {current_balance === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Sin saldo pendiente
            </p>
          )}
        </div>

        {/* Status Description */}
        <div
          className={`p-4 rounded-lg ${config.bg} ${config.color} flex items-center gap-3`}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{config.description}</p>
        </div>

        {/* Payment Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last Payment */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-muted-foreground">
                Último Pago
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {last_payment_date ? formatDate(last_payment_date) : 'N/A'}
            </p>
            {days_since_last_payment !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                Hace {days_since_last_payment} días
              </p>
            )}
          </div>

          {/* Expected Frequency */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-muted-foreground">
                Frecuencia Esperada
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {expected_frequency_days ? `Cada ${expected_frequency_days} días` : 'N/A'}
            </p>
          </div>

          {/* Next Expected Payment - Only show if there's outstanding balance */}
          {has_outstanding_balance && next_expected_payment ? (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-muted-foreground">
                  Próximo Pago Esperado
                </span>
              </div>
              <p
                className={`text-lg font-bold ${
                  is_overdue ? 'text-red-600' : 'text-foreground'
                }`}
              >
                {formatDate(next_expected_payment)}
              </p>
              {is_overdue && days_overdue !== null && (
                <p className="text-xs text-red-600 mt-1 font-semibold">
                  Vencido hace {days_overdue} días
                </p>
              )}
            </div>
          ) : !has_outstanding_balance ? (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">
                  Estado de Pago
                </span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {current_balance < 0 ? 'Sin Pagos Pendientes' : 'Al Día'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {current_balance < 0
                  ? 'Cliente tiene crédito disponible'
                  : 'Sin saldo pendiente'}
              </p>
            </div>
          ) : null}

          {/* Days Since Last Payment - Only show if there's outstanding balance */}
          {has_outstanding_balance &&
          days_since_last_payment !== null &&
          expected_frequency_days ? (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Días Transcurridos
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {days_since_last_payment} / {expected_frequency_days} días
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(progressPercentage)}% del ciclo
              </p>
            </div>
          ) : null}
        </div>

        {/* Progress Bar - Only show if there's outstanding balance */}
        {has_outstanding_balance &&
        expected_frequency_days &&
        days_since_last_payment !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso del Ciclo de Pago</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress
              value={progressPercentage}
              className={`h-2 ${
                is_overdue
                  ? '[&>div]:bg-red-600'
                  : compliance_status === 'approaching_due'
                  ? '[&>div]:bg-orange-500'
                  : '[&>div]:bg-green-600'
              }`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Último pago</span>
              <span>Próximo pago esperado</span>
            </div>
          </div>
        )}

        {/* Overdue Warning */}
        {is_overdue && days_overdue !== null && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Pago Vencido</p>
                <p className="text-sm text-red-700 mt-1">
                  El cliente tiene un retraso de {days_overdue} días en su pago. Se
                  recomienda seguimiento inmediato.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
