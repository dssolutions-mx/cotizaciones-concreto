'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { siteChecksService } from '@/services/siteChecksService';
import { siteCheckSchema, SiteCheckFormInput, validateByType } from '@/components/quality/site-checks/siteCheckSchema';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import SiteCheckFields from '@/components/quality/site-checks/SiteCheckFields';
import { AlertTriangle, ChevronLeft, Loader2, Save } from 'lucide-react';

type Plant = { id: string; name: string };

export default function NewSiteCheckPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);

  const form = useForm<SiteCheckFormInput>({
    resolver: zodResolver(siteCheckSchema),
    defaultValues: {
      mode: 'manual',
      remision_number_manual: '',
      plant_id: '',
      fecha_muestreo: new Date(),
      test_type: 'SLUMP',
      fue_ajustado: false,
    }
  });

  // Load plants
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('plants').select('id, name').eq('is_active', true).order('name');
      setPlants(data || []);
      if (!form.getValues('plant_id') && data && data.length) {
        form.setValue('plant_id', data[0].id);
      }
    };
    load();
  }, []);

  const onSubmit = async (values: SiteCheckFormInput) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const fieldErrors = validateByType(values);
      if (Object.keys(fieldErrors).length > 0) {
        setSubmitError(Object.values(fieldErrors)[0]);
        setIsSubmitting(false);
        return;
      }

      const id = await siteChecksService.createSiteCheck({
        remision_id: null, // Always null for manual mode
        remision_number_manual: values.remision_number_manual,
        plant_id: values.plant_id,
        fecha_muestreo: values.fecha_muestreo,
        hora_salida_planta: values.hora_salida_planta || null,
        hora_llegada_obra: values.hora_llegada_obra || null,
        test_type: values.test_type,
        valor_inicial_cm: values.valor_inicial_cm ?? null,
        fue_ajustado: values.fue_ajustado,
        detalle_ajuste: values.detalle_ajuste ?? null,
        valor_final_cm: values.valor_final_cm ?? null,
        temperatura_ambiente: values.temperatura_ambiente ?? null,
        temperatura_concreto: values.temperatura_concreto ?? null,
        observaciones: values.observaciones ?? null,
        created_by: profile?.id,
      });
      router.push(`/quality/site-checks/${id}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Error al guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedRoles = ['QUALITY_TEAM', 'PLANT_MANAGER', 'LABORATORY', 'EXECUTIVE'];
  const hasAccess = profile && allowedRoles.includes(profile.role);
  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          <p className="text-lg mb-4 text-yellow-700">No tienes permiso para crear registros en obra.</p>
        </div>
      </div>
    );
  }

  const FormFields = <SiteCheckFields form={form} mode="manual" plants={plants} />;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button variant="secondary" onClick={() => router.push('/quality')} className="mb-4 text-label-primary">
          <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Calidad
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Control en Obra</h1>
        <p className="text-gray-500">Registro de revenimiento/extensibilidad y temperaturas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Control en Obra</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {FormFields}
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">{submitError}</div>
              )}
              <div className="flex justify-end">
                <Button type="submit" variant="ghost" className="!bg-primary !text-primary-foreground" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Guardando...</>) : (<><Save className="mr-2 h-4 w-4"/>Guardar</>)}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


