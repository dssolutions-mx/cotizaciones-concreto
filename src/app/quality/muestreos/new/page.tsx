'use client';

import React, { useState, useEffect, useDeferredValue, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Steps,
  StepsContent,
  StepsItem,
} from "@/components/ui/steps";
import {
  AlertTriangle, CalendarIcon, ChevronLeft, Loader2, Save, Truck, User, Package, Droplets,
  Upload, Search, Filter, CalendarDays, Plus, Trash2, Copy, Info
} from 'lucide-react';
import RemisionesPicker from '@/components/quality/RemisionesPicker';
import { cn } from '@/lib/utils';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMuestreo, createMuestreoWithSamples } from '@/services/qualityMuestreoService';
import { crearMuestrasPorEdad } from '@/services/qualityMuestraService';
import { getOrders } from '@/services/orderService';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, createSafeDate } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { addDays, parseISO } from "date-fns";
import SamplePlan from '@/components/quality/muestreos/SamplePlan';
import AgePlanSelector from '@/components/quality/muestreos/AgePlanSelector';
// removed unused list components after modularization
import ManualMuestreoHeader from '@/components/quality/muestreos/ManualMuestreoHeader';
import RemisionInfoCard from '@/components/quality/muestreos/RemisionInfoCard';
import LinkedMuestreoHeader from '@/components/quality/muestreos/LinkedMuestreoHeader';
import OrdersStep from '@/components/quality/muestreos/OrdersStep';
import { muestreoFormSchema, MuestreoFormValues } from '@/components/quality/muestreos/newMuestreoSchema';
import { adjustDateForTimezone, addDaysSafe, computeAgeDays, formatAgeSummary, PlannedSample } from '@/components/quality/muestreos/dateUtils';
import { DateRange } from "react-day-picker";
import RemisionesStep from '@/components/quality/muestreos/RemisionesStep';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MeasurementsFields from '@/components/quality/muestreos/MeasurementsFields';

// schema and date helpers moved to components/quality/muestreos

// PlannedSample type moved to components/quality/muestreos/dateUtils

// createMuestreoWithSamples moved to service layer

export default function NuevoMuestreoPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [activeStep, setActiveStep] = useState(0);
  // Flow mode: 'linked' uses Orden → Remisión → Datos; 'manual' is single-step capture
  const [mode, setMode] = useState<'linked' | 'manual'>('linked');
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [filteredRemisiones, setFilteredRemisiones] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedRemision, setSelectedRemision] = useState<any>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingRemisiones, setIsLoadingRemisiones] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [remisionSearchTerm, setRemisionSearchTerm] = useState('');
  // Defer heavy filter inputs to reduce UI lag
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredRemisionSearchTerm = useDeferredValue(remisionSearchTerm);
  // Sample planning state
  const [plannedSamples, setPlannedSamples] = useState<PlannedSample[]>([]);
  const [clasificacion, setClasificacion] = useState<'FC' | 'MR'>('FC');
  const [edadGarantia, setEdadGarantia] = useState<number>(28);
  const [agePlanUnit, setAgePlanUnit] = useState<'days'|'hours'>('days');
  
  // Add state for storing previous filter state
  const [previousStep, setPreviousStep] = useState<number | null>(null);
  
  // Initialize form with default values
  const form = useForm<MuestreoFormValues>({
    resolver: zodResolver(muestreoFormSchema),
    defaultValues: {
      fecha_muestreo: new Date(),
      numero_muestreo: 1,
      planta: 'P001',
      revenimiento_sitio: 10,
      masa_unitaria: 2400,
      peso_recipiente_vacio: undefined,
      peso_recipiente_lleno: undefined,
      factor_recipiente: 1000,
      temperatura_ambiente: 25,
      temperatura_concreto: 30,
      numero_cilindros: 1,
      numero_vigas: 0,
      manual_reference: '',
    },
  });
  const lastBaseDateRef = useRef<Date | null>((() => {
    const val = form.getValues('fecha_muestreo');
    return (val instanceof Date && !isNaN(val.getTime())) ? val : new Date();
  })());
  // Watch helper fields for MU calculation with stable subscription
  const pesoVacio = form.watch('peso_recipiente_vacio');
  const pesoLleno = form.watch('peso_recipiente_lleno');
  const factorRecipiente = form.watch('factor_recipiente');

  // Auto-calculate masa_unitaria when recipient weights or factor change
  useEffect(() => {
    if (
      typeof pesoVacio === 'number' && !isNaN(pesoVacio) &&
      typeof pesoLleno === 'number' && !isNaN(pesoLleno) &&
      typeof factorRecipiente === 'number' && !isNaN(factorRecipiente)
    ) {
      const net = pesoLleno - pesoVacio; // kg of concrete
      const mu = net * factorRecipiente; // kg/m3
      if (isFinite(mu) && mu > 0) {
        const current = form.getValues('masa_unitaria');
        // Round to nearest integer (no decimals): 23.3 -> 23, 23.5 -> 24
        const nextVal = Math.round(mu);
        if (current !== nextVal) {
          form.setValue('masa_unitaria', nextVal, { shouldValidate: true, shouldDirty: true });
        }
      }
    }
  }, [pesoVacio, pesoLleno, factorRecipiente]);

  // When planning by hours: ensure there is at least one sample matching the selected warranty age in hours
  useEffect(() => {
    if (agePlanUnit !== 'hours') return;
    const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
    const ageHours = Number(edadGarantia);
    if (!base || !isFinite(ageHours)) return;
    setPlannedSamples((previous) => {
      const indexOfHourSample = previous.findIndex((s) => typeof s.age_hours === 'number' && isFinite(s.age_hours));
      const computeTestDate = (): Date => {
        const d = new Date(base || new Date());
        d.setHours(d.getHours() + ageHours);
        return d;
      };
      if (indexOfHourSample >= 0) {
        const copy = [...previous];
        const existing = copy[indexOfHourSample];
        copy[indexOfHourSample] = {
          ...existing,
          tipo_muestra: clasificacion === 'MR' ? 'VIGA' : 'CILINDRO',
          age_hours: ageHours,
          age_days: undefined,
          fecha_programada_ensayo: computeTestDate(),
          diameter_cm: existing.tipo_muestra === 'CILINDRO' ? (existing.diameter_cm || 15) : existing.diameter_cm,
        };
        return copy;
      }
      return [
        ...previous,
        {
          id: uuidv4(),
          tipo_muestra: clasificacion === 'MR' ? 'VIGA' : 'CILINDRO',
          fecha_programada_ensayo: computeTestDate(),
          diameter_cm: 15,
          age_hours: ageHours,
        },
      ];
    });
  }, [agePlanUnit, edadGarantia, clasificacion]);

  // Cargar órdenes solo cuando el flujo es "Remisión existente"
  useEffect(() => {
    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        // Using a subquery to only include orders that have remisiones of type CONCRETO
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, order_number, delivery_date, order_status, total_amount, construction_site,
            client_id,
            clients:client_id(business_name),
            remisiones!inner(id, tipo_remision, remision_number)
          `)
          .in('order_status', ['created', 'validated', 'scheduled'])
          .eq('remisiones.tipo_remision', 'CONCRETO')
          .order('delivery_date', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        
        // Remove duplicate orders (an order may have multiple remisiones)
        const uniqueOrders = Array.from(
          new Map(data.map(order => [order.id, order])).values()
        );
        
        // console.log('Órdenes con remisiones cargadas:', uniqueOrders.length);
        setOrders(uniqueOrders);
        setFilteredOrders(uniqueOrders);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    if (mode === 'linked') {
      loadOrders();
    }
  }, [mode]);

  // Filter orders when search term or date range changes
  useEffect(() => {
    if (!orders.length) return;
    
    let result = [...orders];
    
    // Apply date filter with timezone adjustment
    if (dateRange?.from && dateRange?.to) {
      result = result.filter(order => {
        if (!order.delivery_date) return false;
        const orderDate = adjustDateForTimezone(order.delivery_date);
        return orderDate && orderDate >= dateRange.from! && orderDate <= dateRange.to!;
      });
    }
    
    // Apply search filter with enhanced remision search
    if (deferredSearchTerm) {
      const searchLower = deferredSearchTerm.toLowerCase();
      result = result.filter(order => {
        // Check standard order fields
        const orderMatches = (order.order_number && order.order_number.toString().includes(searchLower)) ||
          (order.clients?.business_name && order.clients.business_name.toLowerCase().includes(searchLower)) ||
          (order.construction_site && order.construction_site.toLowerCase().includes(searchLower));

        // Check remisiones
        const remisionMatches = order.remisiones && order.remisiones.some((remision: { remision_number?: string | number }) => 
          remision.remision_number && remision.remision_number.toString().includes(searchLower)
        );
        
        return orderMatches || remisionMatches;
      });
    }
    
    setFilteredOrders(result);
  }, [orders, deferredSearchTerm, dateRange]);

  // Cargar remisiones cuando se selecciona una orden
  useEffect(() => {
    if (!selectedOrder) return;
    
    const loadRemisiones = async () => {
      setIsLoadingRemisiones(true);
      try {
        // Usar supabase directamente para obtener las remisiones
        const { data, error } = await supabase
          .from('remisiones')
          .select(`
            *,
            recipe:recipes(recipe_code, strength_fc, slump, age_days),
            plants:plant_id(id, code, name),
            orders:order_id(
              clients:client_id(business_name),
              construction_site
            )
          `)
          .eq('order_id', selectedOrder)
          .eq('tipo_remision', 'CONCRETO')
          .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        // Transformar los datos para incluir client_name y construction_name
        const remisionesWithClientInfo = data?.map(remision => ({
          ...remision,
          client_name: remision.orders?.clients?.business_name || 'N/A',
          construction_name: remision.orders?.construction_site || 'N/A',
          planta: remision.plants?.code || remision.plants?.name || 'N/A'
        })) || [];
        
        // console.log('Remisiones cargadas:', remisionesWithClientInfo.length);
        setRemisiones(remisionesWithClientInfo);
        
        // Apply search term immediately if it exists
        if (deferredRemisionSearchTerm) {
          const searchLower = deferredRemisionSearchTerm.toLowerCase();
          const filtered = remisionesWithClientInfo.filter(remision => 
            (remision.remision_number && remision.remision_number.toString().includes(searchLower)) ||
            (remision.client_name && remision.client_name.toLowerCase().includes(searchLower)) ||
            (remision.construction_name && remision.construction_name.toLowerCase().includes(searchLower)) ||
            (remision.recipe?.recipe_code && remision.recipe.recipe_code.toLowerCase().includes(searchLower))
          );
          setFilteredRemisiones(filtered);
        } else {
          setFilteredRemisiones(remisionesWithClientInfo);
        }
      } catch (error) {
        console.error('Error loading remisiones:', error);
      } finally {
        setIsLoadingRemisiones(false);
      }
    };
    
    loadRemisiones();
  }, [selectedOrder, deferredRemisionSearchTerm]);

  // Filter remisiones when search term changes
  useEffect(() => {
    if (!remisiones.length) return;
    
    if (!deferredRemisionSearchTerm) {
      setFilteredRemisiones(remisiones);
      return;
    }
    
    const searchLower = deferredRemisionSearchTerm.toLowerCase();
    const filtered = remisiones.filter(remision => 
      (remision.remision_number && remision.remision_number.toString().includes(searchLower)) ||
      (remision.client_name && remision.client_name.toLowerCase().includes(searchLower)) ||
      (remision.construction_name && remision.construction_name.toLowerCase().includes(searchLower)) ||
      (remision.recipe?.recipe_code && remision.recipe.recipe_code.toLowerCase().includes(searchLower))
    );
    
    setFilteredRemisiones(filtered);
  }, [remisiones, deferredRemisionSearchTerm]);

  // Modify the active step change handling to preserve filters
  const handleStepChange = (newStep: number) => {
    startTransition(() => {
      setPreviousStep(activeStep);
      setActiveStep(newStep);
    });
  };

  // Update the handleOrderSelected function to pass search term to remisiones
  const handleOrderSelected = (orderId: string) => {
    startTransition(() => {
      setSelectedOrder(orderId);
      setSelectedRemision(null);
      if (searchTerm) setRemisionSearchTerm(searchTerm);
      setActiveStep(1);
    });
  };

  const handleRemisionSelected = (remision: any) => {
    startTransition(() => {
      setSelectedRemision(remision);
      if (remision?.id) {
        form.setValue('remision_id', remision.id);
        if (remision.planta) form.setValue('planta', remision.planta);
        if (remision.fecha) {
          const [year, month, day] = remision.fecha.split('-').map((num: string) => parseInt(num, 10));
          const fechaDate = new Date(year, month - 1, day, 12, 0, 0);
          form.setValue('fecha_muestreo', fechaDate);
        }
        const derivedClas = (remision?.recipe?.recipe_code || '').toUpperCase().includes('MR') ? 'MR' : 'FC';
        setClasificacion(derivedClas as 'FC' | 'MR');

        // Determine guarantee age and unit from recipe
        let edad = 28;
        let unit: 'days' | 'hours' = 'days';

        if (remision?.recipe?.age_hours && remision.recipe.age_hours > 0) {
          // If recipe has age_hours, use that and set unit to hours
          edad = remision.recipe.age_hours;
          unit = 'hours';
        } else if (remision?.recipe?.age_days && remision.recipe.age_days > 0) {
          // Otherwise use age_days with days unit
          edad = remision.recipe.age_days;
          unit = 'days';
        }

        setEdadGarantia(edad);
        setAgePlanUnit(unit);
        // No precargar muestras automáticamente en remisión existente
        setPlannedSamples([]);
        setActiveStep(2);
      }
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDateRange(undefined);
    setFilteredOrders(orders);
  };

  const resetRemisionFilters = () => {
    setRemisionSearchTerm('');
    setFilteredRemisiones(remisiones);
  };

  // Group orders by delivery date - completely rewritten for clarity
  const groupedOrders = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    filteredOrders.forEach(order => {
      if (!order.delivery_date) {
        // Handle orders without delivery date
        const key = 'Sin fecha de entrega';
        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
        return;
      }
      
      // Apply timezone correction to get the correct local date
      const correctedDate = adjustDateForTimezone(order.delivery_date);
      if (!correctedDate) return;
      
      // Format as YYYY-MM-DD for grouping key
      const key = formatDate(correctedDate, 'yyyy-MM-dd');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(order);
    });
    
    return groups;
  }, [filteredOrders]);

  const onSubmit = async (data: MuestreoFormValues) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      // DEBUG: Log the original form data
      console.log('🔍 onSubmit - Original form data:', {
        fecha_muestreo: data.fecha_muestreo,
        fecha_muestreo_type: typeof data.fecha_muestreo,
        fecha_muestreo_hours: data.fecha_muestreo instanceof Date ? data.fecha_muestreo.getHours() : 'N/A',
        fecha_muestreo_minutes: data.fecha_muestreo instanceof Date ? data.fecha_muestreo.getMinutes() : 'N/A',
        plannedSamples: plannedSamples.map(s => ({
          age_hours: s.age_hours,
          age_days: s.age_days,
          fecha_programada_ensayo: s.fecha_programada_ensayo,
          fecha_programada_ensayo_hours: s.fecha_programada_ensayo instanceof Date ? s.fecha_programada_ensayo.getHours() : 'N/A',
          fecha_programada_ensayo_minutes: s.fecha_programada_ensayo instanceof Date ? s.fecha_programada_ensayo.getMinutes() : 'N/A'
        }))
      });
      
      // Ensure we're using the remision date if available, but preserve user's time selection
      const finalData = { ...data };
      if (selectedRemision?.fecha) {
        // Get the user's selected time from the form
        const userSelectedTime = data.fecha_muestreo;
        let finalDateTime: Date;
        
        if (userSelectedTime instanceof Date) {
          // User selected a specific time, preserve it but use remision date
          const [year, month, day] = selectedRemision.fecha.split('-').map((num: string) => parseInt(num, 10));
          finalDateTime = new Date(year, month - 1, day, 
            userSelectedTime.getHours(), 
            userSelectedTime.getMinutes(), 
            userSelectedTime.getSeconds(), 
            userSelectedTime.getMilliseconds()
          );
        } else {
          // No time selected, default to 12:00 PM to avoid timezone edge cases
          const [year, month, day] = selectedRemision.fecha.split('-').map((num: string) => parseInt(num, 10));
          finalDateTime = new Date(year, month - 1, day, 12, 0, 0);
        }
        
        finalData.fecha_muestreo = finalDateTime;
        
        // DEBUG: Log the final data after remision processing
        console.log('🔍 onSubmit - After remision processing:', {
          final_fecha_muestreo: finalData.fecha_muestreo,
          final_fecha_muestreo_hours: finalData.fecha_muestreo instanceof Date ? finalData.fecha_muestreo.getHours() : 'N/A',
          final_fecha_muestreo_minutes: finalData.fecha_muestreo instanceof Date ? finalData.fecha_muestreo.getMinutes() : 'N/A'
        });
      }
      
      // Create muestreo and associated samples
      const muestreoId = await createMuestreoWithSamples(
        {
          ...finalData,
          created_by: profile?.id,
          // Set sampling type based on mode and presence of manual_reference
          sampling_type: mode === 'linked' ? 'REMISION_LINKED' :
                        (finalData.manual_reference ? 'STANDALONE' : 'PROVISIONAL'),
          // Include concrete specifications with guarantee age only (standardized)
          concrete_specs: {
            clasificacion: clasificacion,
            unidad_edad: agePlanUnit === 'days' ? 'DÍA' : 'HORA',
            valor_edad: edadGarantia,
            // Removed fc/resistance to standardize field to only contain age and unit
          },
        },
        plannedSamples
      );
      
      // Redirect to the created muestreo page
      router.push(`/quality/muestreos/${muestreoId}`);
    } catch (error) {
      console.error('Error creating muestreo:', error);
      setSubmitError('Ocurrió un error al crear el muestreo. Por favor, intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Verificar roles permitidos
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
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para crear nuevos muestreos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/quality/muestreos')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Muestreos
        </Button>
        
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Nuevo Muestreo</h1>
        <p className="text-gray-500">
          Sigue los pasos para registrar un nuevo muestreo de concreto
        </p>

        {/* Selector de flujo: Remisión existente vs Captura manual */}
        <div className="mt-4 inline-flex rounded-md border bg-white overflow-hidden">
          <button
            className={`px-3 py-1.5 text-sm ${mode === 'linked' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('linked')}
            type="button"
          >
            Remisión existente
          </button>
          <button
            className={`px-3 py-1.5 text-sm border-l ${mode === 'manual' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('manual')}
            type="button"
          >
            Captura manual
          </button>
        </div>
      </div>
      
      {mode === 'linked' ? (
      <Steps value={activeStep} onChange={handleStepChange}>
        <StepsItem title="Seleccionar Orden" description="Elige la orden de concreto">
          <StepsContent className="py-4">
            <OrdersStep
              isLoadingOrders={isLoadingOrders}
              groupedOrders={groupedOrders}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              dateRange={dateRange}
              setDateRange={setDateRange}
              resetFilters={resetFilters}
              selectedOrder={selectedOrder}
              onSelect={handleOrderSelected}
              onCancel={() => router.push('/quality/muestreos')}
              onContinue={() => handleStepChange(1)}
            />
          </StepsContent>
        </StepsItem>
        
        <StepsItem title="Seleccionar Remisión" description="Elige la remisión para muestrear">
          <StepsContent className="py-4">
            <RemisionesStep
              isLoading={isLoadingRemisiones}
              items={filteredRemisiones}
              selectedId={selectedRemision?.id}
              onSelect={handleRemisionSelected}
              searchTerm={remisionSearchTerm}
              setSearchTerm={setRemisionSearchTerm}
              onResetFilters={resetRemisionFilters}
              onBack={() => handleStepChange(0)}
              onContinue={() => handleStepChange(2)}
              canContinue={!!selectedRemision && !isLoadingRemisiones}
            />
          </StepsContent>
        </StepsItem>
        
        <StepsItem title="Datos del Muestreo" description="Completa la información">
          <StepsContent className="py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Información de la Remisión</CardTitle>
                    <CardDescription>Detalles de la remisión seleccionada</CardDescription>
                  </CardHeader>
                  <RemisionInfoCard remision={selectedRemision} onChange={() => handleStepChange(1)} />
                </Card>
              </div>
              
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Datos del Muestreo</CardTitle>
                    <CardDescription>
                      Completa los datos del muestreo para la remisión seleccionada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <LinkedMuestreoHeader
                          form={form as any}
                          onDateChange={(date?: Date) => {
                            const previousBase = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                            form.setValue('fecha_muestreo', date as any);
                            if (date) {
                              setPlannedSamples((prev) => prev.map((s) => {
                                const preservedAge = typeof s.age_days === 'number'
                                  ? s.age_days
                                  : (previousBase ? computeAgeDays(previousBase, s.fecha_programada_ensayo) : 0);
                                return {
                                  ...s,
                                  age_days: preservedAge,
                                  fecha_programada_ensayo: addDaysSafe(date, preservedAge),
                                };
                              }));
                              lastBaseDateRef.current = date;
                            }
                          }}
                          onTimeChange={(hhmm: string) => {
                            const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                            const [h,m] = hhmm.split(':').map(n => parseInt(n,10));
                            if (base && !isNaN(h) && !isNaN(m)) {
                              const newBase = new Date(base);
                              newBase.setHours(h, m, 0, 0);
                              form.setValue('fecha_muestreo', newBase);
                              
                              // Update planned samples with the new time, preserving age calculations
                              setPlannedSamples(prev => prev.map(s => {
                                if (typeof s.age_hours === 'number' && isFinite(s.age_hours)) {
                                  // For hour-based samples, add hours to the new base time
                                  const d = new Date(newBase);
                                  d.setHours(d.getHours() + s.age_hours);
                                  return { ...s, fecha_programada_ensayo: d };
                                } else if (typeof s.age_days === 'number' && isFinite(s.age_days)) {
                                  // For day-based samples, add days to the new base time
                                  const d = new Date(newBase);
                                  d.setDate(d.getDate() + s.age_days);
                                  return { ...s, fecha_programada_ensayo: d };
                                }
                                // If no age specified, keep the existing date but update the time
                                const existingDate = s.fecha_programada_ensayo;
                                if (existingDate instanceof Date) {
                                  const updatedDate = new Date(existingDate);
                                  updatedDate.setHours(h, m, 0, 0);
                                  return { ...s, fecha_programada_ensayo: updatedDate };
                                }
                                return s;
                              }));
                            }
                          }}
                          highlightFromRemision={!!selectedRemision?.fecha}
                        />
                          
                           <FormField
                            control={form.control}
                            name="numero_muestreo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número de Muestreo</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="1"
                                    {...field}
                                    onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Número consecutivo del muestreo para esta remisión
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Manual remisión UI has been moved to the standalone manual flow. */}

                          {/* In linked flow, the planta comes from the remisión and is not editable */}
                          <div>
                            <FormItem>
                              <FormLabel>Planta</FormLabel>
                              <Input
                                readOnly
                                value={selectedRemision?.planta || form.getValues('planta') || ''}
                              />
                              <FormDescription>Se toma de la remisión seleccionada.</FormDescription>
                            </FormItem>
                          </div>

                          {/* Selector de unidad/edad para plan de muestras (misma lógica que en captura manual) */}
                          <div>
                            <FormItem>
                              <FormLabel>Plan de edades</FormLabel>
                              <div className="md:col-span-4">
                                <AgePlanSelector
                                  agePlanUnit={agePlanUnit}
                                  onAgePlanUnitChange={setAgePlanUnit}
                                  edadGarantia={edadGarantia}
                                  onEdadGarantiaChange={setEdadGarantia}
                                />
                              </div>
                            </FormItem>
                          </div>
                        
                        <MeasurementsFields form={form} />
                        
                         <SamplePlan
                          plannedSamples={plannedSamples as any}
                          setPlannedSamples={setPlannedSamples as any}
                          form={form as any}
                          clasificacion={clasificacion}
                          edadGarantia={edadGarantia}
                           agePlanUnit={agePlanUnit}
                          computeAgeDays={computeAgeDays}
                          addDaysSafe={addDaysSafe}
                          formatAgeSummary={formatAgeSummary as any}
                        />
                        
                        {/* Evidencia Fotográfica removida por no usarse */}
                        
                        {submitError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                              <span>{submitError}</span>
                            </div>
                          </div>
                        )}
                        
                        <CardFooter className="flex justify-between px-0 pb-0">
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={() => handleStepChange(1)}
                          >
                            Atrás
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-primary"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Guardar Muestreo
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </StepsContent>
        </StepsItem>
      </Steps>
      ) : (
        <Steps value={0} onChange={() => {}}>
          <StepsItem title="Datos del Muestreo" description="Captura manual sin remisión">
            <StepsContent className="py-4">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Datos del Muestreo (Captura manual)</CardTitle>
                    <CardDescription>
                      Crea el muestreo ingresando los datos manualmente; podrás asociar la remisión más tarde.
                    </CardDescription>
                    
                    {/* Form Status Indicator */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Info className="h-4 w-4" />
                        <span>
                          <strong>Consejo:</strong> Completa todos los campos y revisa la información antes de guardar. 
                          Presiona Enter en cualquier campo para avanzar al siguiente.
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form 
                        onKeyDown={(e) => {
                          // Prevent form submission on Enter key press in input fields
                          if (e.key === 'Enter' && e.target !== e.currentTarget) {
                            e.preventDefault();
                            // Move focus to next field for better UX
                            const formElements = e.currentTarget.elements;
                            const currentIndex = Array.from(formElements).findIndex(el => el === e.target);
                            if (currentIndex >= 0 && currentIndex < formElements.length - 1) {
                              const nextElement = formElements[currentIndex + 1] as HTMLElement;
                              if (nextElement && nextElement.focus) {
                                nextElement.focus();
                              }
                            }
                          }
                        }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <FormField
                            control={form.control}
                            name="fecha_muestreo"
                            render={({ field }) => (
                              <FormItem className="flex flex-col md:col-span-4">
                                <FormLabel>Fecha de Muestreo</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          'w-full pl-3 text-left font-normal',
                                          !field.value && 'text-muted-foreground'
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, 'PPP', { locale: es })
                                        ) : (
                                          <span>Seleccionar fecha</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="fecha_muestreo"
                            render={({ field }) => (
                              <FormItem className="md:col-span-4">
                                <FormLabel>Hora de Muestreo</FormLabel>
                                <FormControl>
                                  <Input
                                    type="time"
                                    value={(function(){
                                      const ts = field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value : new Date();
                                      const hh = String(ts.getHours()).padStart(2, '0');
                                      const mm = String(ts.getMinutes()).padStart(2, '0');
                                      return `${hh}:${mm}`;
                                    })()}
                                    onChange={(e) => {
                                      const base = field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value : new Date();
                                      const [h,m] = e.target.value.split(':').map(n => parseInt(n,10));
                                      if (base && !isNaN(h) && !isNaN(m)) {
                                        const newBase = new Date(base);
                                        newBase.setHours(h, m, 0, 0);
                                        field.onChange(newBase);

                                        // Update planned samples with the new time, preserving age calculations
                                        setPlannedSamples(prev => prev.map(s => {
                                          if (typeof s.age_hours === 'number' && isFinite(s.age_hours)) {
                                            // For hour-based samples, add hours to the new base time
                                            const d = new Date(newBase);
                                            d.setHours(d.getHours() + s.age_hours);
                                            return { ...s, fecha_programada_ensayo: d };
                                          } else if (typeof s.age_days === 'number' && isFinite(s.age_days)) {
                                            // For day-based samples, add days to the new base time
                                            const d = new Date(newBase);
                                            d.setDate(d.getDate() + s.age_days);
                                            return { ...s, fecha_programada_ensayo: d };
                                          }
                                          // If no age specified, keep the existing date but update the time
                                          const existingDate = s.fecha_programada_ensayo;
                                          if (existingDate instanceof Date) {
                                            const updatedDate = new Date(existingDate);
                                            updatedDate.setHours(h, m, 0, 0);
                                            return { ...s, fecha_programada_ensayo: updatedDate };
                                          }
                                          return s;
                                        }));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormDescription>Define la hora exacta del muestreo para planear ensayos por horas y alertas.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="numero_muestreo"
                            render={({ field }) => (
                              <FormItem className="md:col-span-4">
                                <FormLabel>Número de Muestreo</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Controles manuales */}
                          <div className="md:col-span-12">
                            <FormItem>
                              <FormLabel>Remisión (manual)</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-4">
                                  <FormField
                                    control={form.control}
                                    name="manual_reference"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="h-12 flex items-end">Número de remisión</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Número de remisión" className="w-full" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="md:col-span-4">
                                  <AgePlanSelector
                                    agePlanUnit={agePlanUnit}
                                    onAgePlanUnitChange={setAgePlanUnit}
                                    edadGarantia={edadGarantia}
                                    onEdadGarantiaChange={setEdadGarantia}
                                  />
                                </div>
                                <div className="md:col-span-4">
                                  <FormItem>
                                    <FormLabel className="h-12 flex items-end">Clasificación</FormLabel>
                                    <FormControl>
                                      <Select value={clasificacion} onValueChange={(v) => setClasificacion(v as 'FC' | 'MR')}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Clasificación" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="FC">FC (Compresión)</SelectItem>
                                          <SelectItem value="MR">MR (Flexión)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                </div>
                              </div>
                            </FormItem>
                          </div>

                          <FormField
                            control={form.control}
                            name="planta"
                            render={({ field }) => (
                              <FormItem className="md:col-span-4">
                                <FormLabel>Planta</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona la planta" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="P001">Planta 1</SelectItem>
                                    <SelectItem value="P002">Planta 2</SelectItem>
                                    <SelectItem value="P003">Planta 3</SelectItem>
                                    <SelectItem value="P004">Planta 4</SelectItem>
                                    <SelectItem value="P005">Planta 5</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <MeasurementsFields form={form} />

                        {/* Plan de Muestras (manual) */}
                        <SamplePlan
                          plannedSamples={plannedSamples as any}
                          setPlannedSamples={setPlannedSamples as any}
                          form={form as any}
                          clasificacion={clasificacion}
                          edadGarantia={edadGarantia}
                          agePlanUnit={agePlanUnit}
                          computeAgeDays={computeAgeDays}
                          addDaysSafe={addDaysSafe}
                          formatAgeSummary={formatAgeSummary as any}
                        />
                        <div className="hidden">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <h3 className="text-sm font-semibold">Plan de Muestras</h3>
                            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
                              <Button type="button" variant="outline" size="sm" onClick={() => {
                                const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                                const baseStr = base ? formatDate(base, 'yyyy-MM-dd') : formatDate(new Date(), 'yyyy-MM-dd');
                                const days = ((): number[] => {
                                  if (clasificacion === 'FC') {
                                    switch (edadGarantia) {
                                      case 1: return [1, 1, 3];
                                      case 3: return [1, 1, 3, 3];
                                      case 7: return [1, 3, 7, 7];
                                      case 14: return [3, 7, 14, 14];
                                      case 28: return [7, 14, 28, 28];
                                      default: return [7, 14, 28, 28];
                                    }
                                  } else {
                                    switch (edadGarantia) {
                                      case 1: return [1, 1, 3];
                                      case 3: return [1, 3, 3];
                                      case 7: return [3, 7, 7];
                                      case 14: return [7, 14, 14];
                                      case 28: return [7, 28, 28];
                                      default: return [7, 28, 28];
                                    }
                                  }
                                })();
                                const additions: PlannedSample[] = days.map((d) => {
                                  const date = createSafeDate(baseStr)!;
                                  date.setDate(date.getDate() + d);
                                  return { id: uuidv4(), tipo_muestra: clasificacion === 'MR' ? 'VIGA' : 'CILINDRO', fecha_programada_ensayo: date, diameter_cm: 15, age_days: d };
                                });
                                setPlannedSamples((prev) => [...prev, ...additions]);
                              }}>
                                <Plus className="h-4 w-4 mr-1" /> Agregar conjunto sugerido
                              </Button>
                              <Button type="button" size="sm" onClick={() => {
                                const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                                const date = base ? new Date(base) : new Date();
                                date.setDate(date.getDate() + 1);
                                setPlannedSamples((prev) => [...prev, { id: uuidv4(), tipo_muestra: 'CILINDRO', fecha_programada_ensayo: date, diameter_cm: 15, age_days: 1 }]);
                              }}>
                                <Plus className="h-4 w-4 mr-1" /> Agregar muestra
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-gray-500">La edad se calcula desde la fecha de muestreo. Ajusta la edad o la fecha y recalcularemos automáticamente.</p>
                          {plannedSamples.length === 0 ? (
                            <div className="text-sm text-gray-500">No hay muestras planificadas. Agrega un conjunto sugerido o una muestra.</div>
                          ) : (
                            <div className="space-y-2 border rounded-md p-3">
                              {plannedSamples.map((s) => (
                                <div key={s.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 items-center">
                                  <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Tipo</FormLabel>
                                    <Select value={s.tipo_muestra} onValueChange={(val) => {
                                      const v = val as 'CILINDRO' | 'VIGA' | 'CUBO';
                                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, tipo_muestra: v } : p)));
                                    }}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Tipo de muestra" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="CILINDRO">Cilindro</SelectItem>
                                        <SelectItem value="VIGA">Viga</SelectItem>
                                        <SelectItem value="CUBO">Cubo</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {s.tipo_muestra === 'CILINDRO' && (
                                    <div className="md:col-span-3">
                                      <FormLabel className="text-xs">Diámetro (cm)</FormLabel>
                                      <Select value={String(s.diameter_cm || 15)} onValueChange={(val) => {
                                        const num = parseInt(val, 10);
                                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, diameter_cm: num } : p)));
                                      }}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Diámetro" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="10">10 cm</SelectItem>
                                          <SelectItem value="15">15 cm</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {s.tipo_muestra === 'CUBO' && (
                                    <div className="md:col-span-3">
                                      <FormLabel className="text-xs">Lado del cubo (cm)</FormLabel>
                                      <Select value={String(s.cube_side_cm || 15)} onValueChange={(val) => {
                                        const num = parseInt(val, 10);
                                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, cube_side_cm: num } : p)));
                                      }}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Tamaño" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="5">5 cm</SelectItem>
                                          <SelectItem value="10">10 cm</SelectItem>
                                          <SelectItem value="15">15 cm</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  <div className="md:col-span-1">
                                    <FormLabel className="text-xs">Edad (días)</FormLabel>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={(function() {
                                        const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                                        const age = typeof s.age_days === 'number' && isFinite(s.age_days) ? s.age_days : (base ? computeAgeDays(base, s.fecha_programada_ensayo) : 0);
                                        return String(age);
                                      })()}
                                      onChange={(e) => {
                                        const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                                        const val = parseInt(e.target.value || '0', 10);
                                        const ageDays = isNaN(val) ? 0 : val;
                                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                                          ...p,
                                          age_days: ageDays,
                                          age_hours: undefined,
                                          fecha_programada_ensayo: base ? addDaysSafe(base, ageDays) : p.fecha_programada_ensayo,
                                        } : p)));
                                      }}
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <FormLabel className="text-xs">Edad (horas)</FormLabel>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={typeof s.age_hours === 'number' && isFinite(s.age_hours) ? String(s.age_hours) : ''}
                                      onChange={(e) => {
                                        const base = (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})();
                                        const val = parseInt(e.target.value || '0', 10);
                                        const ageHours = isNaN(val) ? 0 : val;
                                        setPlannedSamples(prev => prev.map(p => p.id === s.id ? {
                                          ...p,
                                          age_hours: ageHours,
                                          age_days: undefined,
                                          fecha_programada_ensayo: (() => { const d = new Date(base || new Date()); d.setHours(d.getHours() + ageHours); return d; })(),
                                        } : p));
                                      }}
                                    />
                                  </div>
                                  <div className={cn("", (s.tipo_muestra === 'CILINDRO' || s.tipo_muestra === 'CUBO') ? "md:col-span-3" : "md:col-span-6") }>
                                    <FormLabel className="text-xs">Fecha programada de ensayo</FormLabel>
                                    <Input type="date" value={formatDate(s.fecha_programada_ensayo, 'yyyy-MM-dd')} onChange={(e) => {
                                      const val = e.target.value;
                                      const [y, m, d] = val.split('-').map((n) => parseInt(n, 10));
                                      const newDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
                                      const base = (() => {
                                        const val = form.getValues('fecha_muestreo');
                                        return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
                                      })();
                                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                                        ...p,
                                        fecha_programada_ensayo: newDate,
                                        age_days: base ? computeAgeDays(base, newDate) : p.age_days,
                                      } : p)));
                                    }} />
                                  </div>
                                  <div className="md:col-span-2">
                                    <FormLabel className="text-xs">Hora de Ensayo (local)</FormLabel>
                                    <Input
                                      type="time"
                                      value={(function(){
                                        const ts = s.fecha_programada_ensayo as Date;
                                        const hh = String(ts.getHours()).padStart(2,'0');
                                        const mm = String(ts.getMinutes()).padStart(2,'0');
                                        return `${hh}:${mm}`;
                                      })()}
                                      onChange={(e) => {
                                        const [h,m] = e.target.value.split(':').map(n => parseInt(n,10));
                                        if (!isNaN(h) && !isNaN(m)) {
                                          setPlannedSamples(prev => prev.map(p => {
                                            if (p.id !== s.id) return p;
                                            const d = new Date(p.fecha_programada_ensayo);
                                            d.setHours(h, m, 0, 0);
                                            return { ...p, fecha_programada_ensayo: d };
                                          }));
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="md:col-span-1 flex justify-end">
                                    <Button type="button" variant="outline" size="icon" onClick={() => setPlannedSamples((prev) => prev.filter((p) => p.id !== s.id))}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="text-xs text-gray-500">
                                Se crearán {plannedSamples.length} muestras{formatAgeSummary(plannedSamples, (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})() ? (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})() : undefined) ? 
                                  ` · Distribución de edades: ${formatAgeSummary(plannedSamples, (() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})())}` : ''}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Evidencia Fotográfica removida por no usarse */}

                        {submitError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                              <span>{submitError}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-3">
                          {/* Validation Summary */}
                          {!form.formState.isValid && (
                            <div className="flex-1 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Por favor, completa todos los campos requeridos antes de continuar.</span>
                              </div>
                            </div>
                          )}
                          
                          <Button 
                            type="button" 
                            className="bg-primary" 
                            disabled={isSubmitting || !form.formState.isValid}
                            onClick={() => {
                              if (!form.formState.isValid) {
                                // Trigger validation to show errors
                                form.trigger();
                                return;
                              }
                              // Show confirmation dialog
                              setShowSubmitConfirmation(true);
                            }}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Revisar y Guardar
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {/* Submit Confirmation Dialog */}
                        {showSubmitConfirmation && (
                          <div 
                            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                            onClick={() => setShowSubmitConfirmation(false)}
                          >
                            <div 
                              className="bg-white rounded-lg p-6 max-w-md mx-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <Info className="h-6 w-6 text-blue-600" />
                                <h3 className="text-lg font-semibold">Confirmar Envío</h3>
                              </div>
                              
                              <div className="text-gray-700 mb-6 space-y-3">
                                <p>
                                  ¿Estás seguro de que quieres guardar este muestreo? 
                                  Verifica que toda la información esté correcta antes de continuar.
                                </p>
                                
                                {/* Summary of what will be created */}
                                <div className="bg-gray-50 p-3 rounded-md text-sm">
                                  <h4 className="font-medium mb-2">Resumen del muestreo:</h4>
                                  <ul className="space-y-1 text-gray-600">
                                    <li>• Planta: {form.getValues('planta')}</li>
                                    <li>• Fecha: {form.getValues('fecha_muestreo') ? format((() => {
  const val = form.getValues('fecha_muestreo');
  return val instanceof Date && !isNaN(val.getTime()) ? val : new Date();
})(), 'PPP', { locale: es }) : 'No definida'}</li>
                                    <li>• Número de muestreo: {form.getValues('numero_muestreo')}</li>
                                    <li>• Muestras a crear: {plannedSamples.length}</li>
                                    {form.getValues('manual_reference') && (
                                      <li>• Referencia manual: {form.getValues('manual_reference')}</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                              
                              <div className="flex justify-end gap-3">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setShowSubmitConfirmation(false)}
                                  disabled={isSubmitting}
                                >
                                  Cancelar
                                </Button>
                                <Button 
                                  className="bg-primary" 
                                  onClick={() => {
                                    setShowSubmitConfirmation(false);
                                    // Now submit the form
                                    form.handleSubmit(onSubmit)();
                                  }}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Guardando...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="mr-2 h-4 w-4" />
                                      Sí, Guardar
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </StepsContent>
          </StepsItem>
        </Steps>
      )}
    </div>
  );
} 