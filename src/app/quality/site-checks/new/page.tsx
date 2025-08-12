'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { siteChecksService } from '@/services/siteChecksService';
import { siteCheckSchema, SiteCheckFormInput, validateByType } from '@/components/quality/site-checks/siteCheckSchema';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import SiteCheckFields from '@/components/quality/site-checks/SiteCheckFields';
import { Steps, StepsContent, StepsItem } from '@/components/ui/steps';
import { AlertTriangle, ChevronLeft, Loader2, Save } from 'lucide-react';

import OrdersStep from '@/components/quality/muestreos/OrdersStep';
import RemisionesStep from '@/components/quality/muestreos/RemisionesStep';

type Plant = { id: string; name: string };

export default function NewSiteCheckPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [mode, setMode] = useState<'linked' | 'manual'>('linked');
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);

  // existing remision flow
  const [orders, setOrders] = useState<any[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<Record<string, any[]>>({});
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [isLoadingRemisiones, setIsLoadingRemisiones] = useState(false);
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [filteredRemisiones, setFilteredRemisiones] = useState<any[]>([]);
  const [selectedRemision, setSelectedRemision] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [remisionSearchTerm, setRemisionSearchTerm] = useState('');

  const form = useForm<SiteCheckFormInput>({
    resolver: zodResolver(siteCheckSchema),
    defaultValues: {
      mode: 'linked',
      remision_number_manual: '',
      plant_id: '',
      fecha_muestreo: new Date(),
      test_type: 'SLUMP',
      fue_ajustado: false,
    }
  });

  // Load plants for manual mode
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

  // Orders for linked mode (only concrete remisiones)
  useEffect(() => {
    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`id, order_number, delivery_date, order_status, construction_site, clients:client_id(business_name), remisiones!inner(id, tipo_remision, remision_number)`) 
          .in('order_status', ['created','validated','scheduled'])
          .eq('remisiones.tipo_remision', 'CONCRETO')
          .order('delivery_date', { ascending: false })
          .limit(100);
        if (error) throw error;
        const uniqueOrders = Array.from(new Map((data||[]).map(o => [o.id, o])).values());
        const groups: Record<string, any[]> = {};
        uniqueOrders.forEach(o => {
          const k = o.delivery_date ? String(o.delivery_date).slice(0,10) : 'Sin fecha';
          if (!groups[k]) groups[k] = [];
          groups[k].push(o);
        });
        setOrders(uniqueOrders);
        setGroupedOrders(groups);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    if (mode === 'linked') loadOrders();
  }, [mode]);

  // Remisiones for selected order
  useEffect(() => {
    const loadRemisiones = async () => {
      if (!selectedOrder) return;
      setIsLoadingRemisiones(true);
      try {
        const { data, error } = await supabase
          .from('remisiones')
          .select(`*, recipe:recipes(recipe_code, strength_fc, slump, age_days), orders:order_id(clients:client_id(business_name), construction_site)`) 
          .eq('order_id', selectedOrder)
          .eq('tipo_remision','CONCRETO')
          .order('fecha', { ascending: false });
        if (error) throw error;
        setRemisiones(data || []);
        setFilteredRemisiones(data || []);
      } finally {
        setIsLoadingRemisiones(false);
      }
    };
    if (selectedOrder) loadRemisiones();
  }, [selectedOrder]);

  const handleOrderSelected = (orderId: string) => {
    setSelectedOrder(orderId);
    setSelectedRemision(null);
    setActiveStep(1);
  };

  const handleRemisionSelected = (remision: any) => {
    setSelectedRemision(remision);
    form.setValue('remision_id', remision.id);
    form.setValue('remision_number_manual', String(remision.remision_number || ''));
    // Prefer plant_id from remision if available; fallback to current selection
    if (remision.plant_id) form.setValue('plant_id', remision.plant_id);
    setActiveStep(2);
  };

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
        remision_id: values.remision_id || null,
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

  const FormFields = <SiteCheckFields form={form} mode={mode} plants={plants} />;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.push('/quality')} className="mb-4">
          <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Calidad
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Registro en Obra</h1>
        <p className="text-gray-500">Revenimiento/Extensibilidad y Temperatura en obra</p>

        {/* Mode selector */}
        <div className="mt-4 inline-flex rounded-md border bg-white overflow-hidden">
          <button className={`px-3 py-1.5 text-sm ${mode==='linked' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`} onClick={()=> setMode('linked')} type="button">Remisión existente</button>
          <button className={`px-3 py-1.5 text-sm border-l ${mode==='manual' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`} onClick={()=> setMode('manual')} type="button">Captura manual</button>
        </div>
      </div>

      {mode === 'linked' ? (
        <Steps value={activeStep} onChange={(s)=> setActiveStep(s)}>
          <StepsItem title="Seleccionar Orden" description="Elige la orden de concreto">
            <StepsContent className="py-4">
              <OrdersStep
                isLoadingOrders={isLoadingOrders}
                groupedOrders={groupedOrders}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                dateRange={undefined}
                setDateRange={()=>{}}
                resetFilters={()=>{}}
                selectedOrder={selectedOrder}
                onSelect={handleOrderSelected}
                onCancel={() => router.push('/quality')}
                onContinue={() => setActiveStep(1)}
              />
            </StepsContent>
          </StepsItem>
          <StepsItem title="Seleccionar Remisión" description="Elige la remisión">
            <StepsContent className="py-4">
              <RemisionesStep
                isLoading={isLoadingRemisiones}
                items={filteredRemisiones}
                selectedId={selectedRemision?.id}
                onSelect={handleRemisionSelected}
                searchTerm={remisionSearchTerm}
                setSearchTerm={setRemisionSearchTerm}
                onResetFilters={()=> setFilteredRemisiones(remisiones)}
                onBack={() => setActiveStep(0)}
                onContinue={() => setActiveStep(2)}
                canContinue={!!selectedRemision && !isLoadingRemisiones}
              />
            </StepsContent>
          </StepsItem>
          <StepsItem title="Datos en Obra" description="Completa la información">
            <StepsContent className="py-4">
              <Card>
                <CardHeader>
                  <CardTitle>Datos del registro</CardTitle>
                  <CardDescription>Se asociará a la remisión seleccionada</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {FormFields}
                      {submitError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">{submitError}</div>
                      )}
                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={()=> setActiveStep(1)}>Atrás</Button>
                        <Button type="submit" className="bg-primary" disabled={isSubmitting}>
                          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Guardando...</>) : (<><Save className="mr-2 h-4 w-4"/>Guardar</>)}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </StepsContent>
          </StepsItem>
        </Steps>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Datos del registro (manual)</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {FormFields}
                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">{submitError}</div>
                )}
                <div className="flex justify-end">
                  <Button type="submit" className="bg-primary" disabled={isSubmitting}>
                    {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Guardando...</>) : (<><Save className="mr-2 h-4 w-4"/>Guardar</>)}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


