'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Calendar,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditStatus, PaymentComplianceInfo } from '@/lib/supabase/creditTerms';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreditContextPanelProps {
  clientId: string;
  clientName: string;
  orderAmount: number;
  compact?: boolean;
}

export default function CreditContextPanel({
  clientId,
  clientName,
  orderAmount,
  compact = false,
}: CreditContextPanelProps) {
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [paymentCompliance, setPaymentCompliance] = useState<PaymentComplianceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreditInfo();
  }, [clientId, orderAmount]);

  const fetchCreditInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/credit-terms/status/${clientId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar información de crédito');
      }

      const result = await response.json();
      
      if (!result.data) {
        throw new Error('No se recibieron datos del servidor');
      }

      setCreditStatus(result.data);
      setPaymentCompliance(result.data.payment_compliance || null);
    } catch (error) {
      console.error('Error fetching credit info:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido al cargar información de crédito');
      // Don't clear creditStatus on error - keep showing last known state if available
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !creditStatus) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  // Show error state if we have an error and no previous data
  if (error && !creditStatus) {
    return (
      <Card className="shadow-md border-2 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-700">
            <AlertCircle className="h-5 w-5" />
            Error al Cargar Información de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 mb-3">{error}</p>
            <Button
              onClick={fetchCreditInfo}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
          <Link href={`/clients/${clientId}/credito`} className="block">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Perfil de Crédito Completo
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // If no credit status but no error, show a message
  if (!creditStatus && !error) {
    return (
      <Card className="shadow-md border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Contexto de Crédito
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{clientName}</p>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-3">
              No se pudo cargar la información de crédito en este momento.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={fetchCreditInfo}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
              <Link href={`/clients/${clientId}/credito`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Perfil de Crédito
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const projectedBalance = creditStatus.current_balance + orderAmount;
  const projectedAvailable = creditStatus.credit_limit - projectedBalance;
  const wouldExceedLimit = projectedBalance > creditStatus.credit_limit;
  const projectedUtilization = creditStatus.credit_limit > 0
    ? (projectedBalance / creditStatus.credit_limit) * 100
    : 0;

  // Determine impact status
  const getImpactStatus = () => {
    if (!creditStatus.has_terms) {
      return {
        label: 'Sin Términos de Crédito',
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        icon: AlertCircle,
      };
    }

    if (wouldExceedLimit) {
      return {
        label: 'Excederá el Límite',
        color: 'text-red-700',
        bg: 'bg-red-100',
        icon: AlertCircle,
      };
    }

    if (projectedUtilization >= 90) {
      return {
        label: 'Utilización Alta',
        color: 'text-orange-700',
        bg: 'bg-orange-100',
        icon: AlertCircle,
      };
    }

    return {
      label: 'Dentro del Límite',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: CheckCircle,
    };
  };

  const impactStatus = getImpactStatus();
  const ImpactIcon = impactStatus.icon;

  if (compact) {
    return (
      <Card className={`shadow-sm border-2 ${wouldExceedLimit ? 'border-red-300' : 'border-gray-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">Impacto en Crédito</span>
            </div>
            <Badge className={`${impactStatus.bg} ${impactStatus.color} border-0`}>
              <ImpactIcon className="h-3 w-3 mr-1" />
              {impactStatus.label}
            </Badge>
          </div>

          {creditStatus.has_terms ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-1">Saldo Actual</p>
                <p className="font-semibold">{formatCurrency(creditStatus.current_balance)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Este Pedido</p>
                <p className="font-semibold text-blue-600">+{formatCurrency(orderAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Saldo Proyectado</p>
                <p className={`font-semibold ${wouldExceedLimit ? 'text-red-600' : 'text-foreground'}`}>
                  {formatCurrency(projectedBalance)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Disponible</p>
                <p className={`font-semibold ${projectedAvailable < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(projectedAvailable)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cliente no tiene términos de crédito configurados.
            </p>
          )}

          <Link href={`/clients/${clientId}/credito`} className="mt-3 block">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="h-3 w-3 mr-2" />
              Ver Perfil de Crédito
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-md border-2 ${wouldExceedLimit ? 'border-red-400' : 'border-gray-200'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Contexto de Crédito
          </CardTitle>
          <Badge className={`${impactStatus.bg} ${impactStatus.color} border-0 px-3 py-1`}>
            <ImpactIcon className="h-4 w-4 mr-1" />
            {impactStatus.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{clientName}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!creditStatus.has_terms ? (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Sin Términos de Crédito</p>
                <p className="text-sm text-gray-600">
                  Este cliente no tiene límite de crédito ni condiciones configuradas. El validador
                  puede aprobar según criterio propio.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Current Credit Status */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Estado Actual</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Límite de Crédito</p>
                  <p className="font-bold text-sm">{formatCurrency(creditStatus.credit_limit)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Saldo Actual</p>
                  <p className="font-bold text-sm">{formatCurrency(creditStatus.current_balance)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Disponible</p>
                  <p className={`font-bold text-sm ${creditStatus.credit_available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(creditStatus.credit_available)}
                  </p>
                </div>
              </div>

              {/* Current Utilization Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Utilización Actual</span>
                  <span className="text-xs font-semibold">
                    {Math.round(creditStatus.utilization_percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      creditStatus.utilization_percentage >= 100
                        ? 'bg-red-600'
                        : creditStatus.utilization_percentage >= 70
                        ? 'bg-orange-500'
                        : 'bg-green-600'
                    }`}
                    style={{
                      width: `${Math.min(creditStatus.utilization_percentage, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Order Impact */}
            <div className="space-y-3 pt-3 border-t">
              <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Impacto de Este Pedido
              </h4>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Monto del Pedido</span>
                  <span className="text-lg font-bold text-blue-600">
                    +{formatCurrency(orderAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Saldo Proyectado</span>
                  <span className={`text-lg font-bold ${wouldExceedLimit ? 'text-red-600' : 'text-foreground'}`}>
                    {formatCurrency(projectedBalance)}
                  </span>
                </div>
              </div>

              {/* Projected Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${wouldExceedLimit ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className="text-xs text-muted-foreground mb-1">Crédito Disponible</p>
                  <p className={`font-bold text-sm ${projectedAvailable < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(projectedAvailable)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Utilización Proyectada</p>
                  <p className={`font-bold text-sm ${projectedUtilization >= 100 ? 'text-red-600' : projectedUtilization >= 70 ? 'text-orange-600' : 'text-foreground'}`}>
                    {Math.round(projectedUtilization)}%
                  </p>
                </div>
              </div>

              {/* Projected Utilization Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Barra de Utilización Proyectada</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      projectedUtilization >= 100
                        ? 'bg-red-600'
                        : projectedUtilization >= 70
                        ? 'bg-orange-500'
                        : 'bg-green-600'
                    }`}
                    style={{
                      width: `${Math.min(projectedUtilization, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Payment Compliance Info */}
            {paymentCompliance && paymentCompliance.compliance_status !== 'no_terms' && (
              <div className="space-y-2 pt-3 border-t">
                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cumplimiento de Pagos
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Último Pago</p>
                    <p className="font-semibold">
                      {paymentCompliance.last_payment_date
                        ? formatDate(paymentCompliance.last_payment_date)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Frecuencia</p>
                    <p className="font-semibold">
                      {paymentCompliance.expected_frequency_days
                        ? `Cada ${paymentCompliance.expected_frequency_days} días`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {paymentCompliance.is_overdue && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900 text-sm">Pago Vencido</p>
                        <p className="text-xs text-red-700 mt-1">
                          {paymentCompliance.days_overdue} días de retraso
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning if over limit */}
            {wouldExceedLimit && (
              <div className="p-4 bg-red-50 border border-red-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 mb-1">Pedido Excede el Límite de Crédito</p>
                    <p className="text-sm text-red-700">
                      Este pedido llevará al cliente{' '}
                      <strong>{formatCurrency(Math.abs(projectedAvailable))}</strong> sobre su
                      límite de crédito. Considera solicitar un pago o aumentar el límite antes de
                      aprobar.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link href={`/clients/${clientId}/credito`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Ver Términos Completos
            </Button>
          </Link>
        </div>

        {/* Error banner if error occurred but we have previous data */}
        {error && creditStatus && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-yellow-900 mb-1">Advertencia</p>
                <p className="text-xs text-yellow-700 mb-2">{error}</p>
                <Button
                  onClick={fetchCreditInfo}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Note */}
        <p className="text-xs text-muted-foreground italic border-t pt-3">
          Nota: El validador de crédito tiene la decisión final. Esta información es solo de
          referencia.
        </p>
      </CardContent>
    </Card>
  );
}
