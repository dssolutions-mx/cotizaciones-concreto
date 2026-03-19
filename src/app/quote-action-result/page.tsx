'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/Container';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function errorDescription(reason: string | null): string {
  if (reason === 'token_expired') {
    return 'El enlace ha expirado. Apruebe o rechace desde la aplicación.';
  }
  if (reason === 'token_not_found') {
    return 'No se encontró el enlace. Puede que ya haya sido utilizado.';
  }
  if (reason === 'missing_params' || reason === 'missing_token') {
    return 'El enlace no es válido o está incompleto. Intente desde el correo o desde la aplicación.';
  }
  if (reason === 'invalid_token' || reason === 'invalid_action') {
    return 'El enlace no es válido. Solicite un nuevo correo o use la aplicación.';
  }
  if (reason === 'update_failed' || reason === 'approval_failed') {
    return 'No se pudo completar la acción. Intente desde la aplicación.';
  }
  if (reason === 'server_error' || reason === 'unexpected_error') {
    return 'Ocurrió un error en el servidor. Intente de nuevo más tarde o desde la aplicación.';
  }
  return 'Hubo un problema al procesar la acción. Intente desde la aplicación.';
}

function QuoteActionResultContent() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const reason = searchParams.get('reason');
  const alreadyProcessed = searchParams.get('already_processed') === 'true';

  const loginHref = '/login?redirect=' + encodeURIComponent('/quotes');

  useEffect(() => {
    if (!action) return;
    if (action === 'approved') {
      toast.success(alreadyProcessed ? 'Cotización ya estaba aprobada' : 'Cotización aprobada correctamente');
    } else if (action === 'rejected') {
      toast.success(alreadyProcessed ? 'Cotización ya estaba rechazada' : 'Cotización rechazada');
    } else if (action === 'error') {
      toast.error(errorDescription(reason));
    }
  }, [action, reason, alreadyProcessed]);

  const config = useMemo(() => {
    if (!action) {
      return {
        icon: AlertCircle,
        className: 'border-amber-200/50 bg-amber-50',
        title: 'Enlace inválido',
        desc: 'Abra el enlace desde el correo de aprobación o inicie sesión para gestionar cotizaciones.',
      } as const;
    }
    if (action === 'approved') {
      return {
        icon: CheckCircle,
        className: 'border-green-200/50 bg-green-50',
        title: alreadyProcessed ? 'Cotización ya aprobada' : 'Cotización aprobada',
        desc: 'La cotización fue aprobada correctamente desde el correo electrónico.',
      } as const;
    }
    if (action === 'rejected') {
      return {
        icon: XCircle,
        className: 'border-red-200/50 bg-red-50',
        title: alreadyProcessed ? 'Cotización ya rechazada' : 'Cotización rechazada',
        desc: 'La cotización fue rechazada desde el correo electrónico.',
      } as const;
    }
    if (action === 'error') {
      return {
        icon: AlertCircle,
        className: 'border-amber-200/50 bg-amber-50',
        title: 'Error en la acción',
        desc: errorDescription(reason),
      } as const;
    }
    return {
      icon: AlertCircle,
      className: 'border-amber-200/50 bg-amber-50',
      title: 'No se pudo mostrar el resultado',
      desc: 'Intente iniciar sesión y gestionar la cotización desde la aplicación.',
    } as const;
  }, [action, reason, alreadyProcessed]);

  const Icon = config.icon;

  return (
    <Container className="py-16 max-w-lg mx-auto">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Resultado de la acción</h1>
          <p className="text-sm text-muted-foreground mt-1">Cotización — enlace desde correo</p>
        </div>
        <Alert className={config.className}>
          <Icon className="h-4 w-4" />
          <AlertTitle>{config.title}</AlertTitle>
          <AlertDescription>{config.desc}</AlertDescription>
        </Alert>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href={loginHref}>Iniciar sesión</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}

export default function QuoteActionResultPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-16 max-w-lg mx-auto flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-600 border-t-transparent" />
        </Container>
      }
    >
      <QuoteActionResultContent />
    </Suspense>
  );
}
