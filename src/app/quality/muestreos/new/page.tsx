'use client';

import React, { useState, useEffect } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
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
  Upload, Search, Filter, CalendarDays
} from 'lucide-react';
import RemisionesPicker from '@/components/quality/RemisionesPicker';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMuestreo, crearMuestrasPorEdad } from '@/services/qualityService';
import { getOrders } from '@/services/orderService';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, createSafeDate } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { addDays, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

// Validation schema for the form
const muestreoFormSchema = z.object({
  remision_id: z.string().min(1, 'Selecciona una remisión'),
  fecha_muestreo: z.date({
    required_error: 'La fecha de muestreo es requerida',
  }),
  numero_muestreo: z.number().min(1, 'El número de muestreo es requerido'),
  planta: z.enum(['P1', 'P2', 'P3', 'P4'], {
    required_error: 'La planta es requerida',
  }),
  revenimiento_sitio: z.number()
    .min(0, 'El revenimiento debe ser un número positivo'),
  masa_unitaria: z.number()
    .min(0, 'La masa unitaria debe ser un número positivo'),
  temperatura_ambiente: z.number()
    .min(-30, 'La temperatura ambiente debe ser mayor a -30°C')
    .max(60, 'La temperatura ambiente debe ser menor a 60°C'),
  temperatura_concreto: z.number()
    .min(0, 'La temperatura del concreto debe ser mayor a 0°C')
    .max(60, 'La temperatura del concreto debe ser menor a 60°C'),
  numero_cilindros: z.number()
    .min(0, 'El número de cilindros debe ser un número no negativo'),
  numero_vigas: z.number()
    .min(0, 'El número de vigas debe ser un número no negativo'),
});

type MuestreoFormValues = z.infer<typeof muestreoFormSchema>;

// Helper function to adjust date for timezone issues
const adjustDateForTimezone = (dateInput: string | Date) => {
  if (!dateInput) return null;
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  // Create a new date with timezone offset correction
  const correctedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return correctedDate;
};

export async function createMuestreoWithSamples(data: MuestreoFormValues & { created_by?: string }) {
  try {
    // First, create the muestreo without the cylinder/beam fields
    const { numero_cilindros, numero_vigas, ...muestreoData } = data;
    
    // Ensure the fecha_muestreo is a string in YYYY-MM-DD format for consistent timezone handling
    const muestreoToCreate = {
      ...muestreoData,
      fecha_muestreo: typeof muestreoData.fecha_muestreo === 'string' 
        ? muestreoData.fecha_muestreo 
        : formatDate(muestreoData.fecha_muestreo, 'yyyy-MM-dd')
    };
    
    console.log('Creating muestreo:', muestreoToCreate);
    
    // Create the muestreo record in the database
    const { data: muestreo, error } = await supabase
      .from('muestreos')
      .insert(muestreoToCreate)
      .select()
      .single();
    
    if (error) {
      console.error('Error en createMuestreo:', error);
      throw error;
    }
    
    console.log('Muestreo creado:', muestreo);
    
    // Get the recipe details to determine clasificacion and edadGarantia
    const { data: remisionData, error: remisionError } = await supabase
      .from('remisiones')
      .select(`
        recipe:recipes(
          id,
          strength_fc,
          age_days,
          recipe_versions(notes, is_current)
        )
      `)
      .eq('id', muestreoToCreate.remision_id)
      .single();
    
    if (remisionError) {
      console.error('Error fetching remision details:', remisionError);
      throw remisionError;
    }
    
    // Extract recipe details safely
    const recipeData = remisionData?.recipe as { 
      id?: string;
      strength_fc?: number; 
      age_days?: number;
      recipe_versions?: { notes: string; is_current: boolean }[];
    } | null;
    
    // Default age_days to 28 if not available
    const edadGarantia = recipeData?.age_days || 28;
    
    // Determine classification from recipe notes or strength values
    let clasificacion = 'FC';
    
    // Check recipe versions for MR in notes
    const currentVersion = recipeData?.recipe_versions?.find(v => v.is_current);
    if (currentVersion?.notes?.includes('MR')) {
      clasificacion = 'MR';
    }
    
    console.log('Recipe details:', {
      clasificacion,
      edadGarantia,
      recipeData: JSON.stringify(recipeData)
    });
    
    let createdCylinders = false;
    let createdBeams = false;
    
    // Create cylinder samples if any
    if (numero_cilindros && numero_cilindros > 0) {
      try {
        console.log('Creating cylinder samples:', {
          muestreoId: muestreo.id,
          clasificacion,
          edadGarantia,
          cantidad: numero_cilindros
        });
        
        // Call the improved SQL function to create samples
        await crearMuestrasPorEdad(
          muestreo.id,
          clasificacion as 'FC' | 'MR',
          edadGarantia,
          numero_cilindros
        );
        
        createdCylinders = true;
        console.log('Cylinder samples created successfully');
      } catch (cylinderError) {
        console.error('Error creating cylinder samples:', cylinderError);
        // Continue execution instead of throwing - we'll report this later
      }
    }
    
    // Create beam samples if any
    if (numero_vigas && numero_vigas > 0) {
      try {
        console.log('Creating beam samples:', {
          muestreoId: muestreo.id,
          clasificacion: 'MR', // Beams are always for MR
          edadGarantia,
          cantidad: numero_vigas
        });
        
        // Call the improved SQL function to create samples
        await crearMuestrasPorEdad(
          muestreo.id,
          'MR', // MR for beam samples
          edadGarantia,
          numero_vigas
        );
        
        createdBeams = true;
        console.log('Beam samples created successfully');
      } catch (beamError) {
        console.error('Error creating beam samples:', beamError);
        // Continue execution instead of throwing - we'll report this later
      }
    }
    
    // Add a small delay to ensure SQL function has time to create samples
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify samples were created
    const { count, error: countError } = await supabase
      .from('muestras')
      .select('*', { count: 'exact', head: true })
      .eq('muestreo_id', muestreo.id);
      
    if (countError) {
      console.error('Error counting samples:', countError);
    } else {
      console.log(`Found ${count} samples for muestreo ${muestreo.id}`);
      
      // Only use fallback if SQL function failed to create samples
      if ((count === 0 || count === null) && (numero_cilindros > 0 || numero_vigas > 0)) {
        console.log('SQL function failed to create samples, using client-side fallback');
      
        const samplesToCreate = [];
        let sampleCount = 1; // Counter for unique identification

        // Direct sample creation logic as fallback
        // Use the date string directly without timezone conversion to avoid date shifts
        const sampleDateString = typeof muestreoToCreate.fecha_muestreo === 'string'
          ? muestreoToCreate.fecha_muestreo
          : formatDate(muestreoToCreate.fecha_muestreo, 'yyyy-MM-dd');

        // Create cylinder samples directly if SQL function failed
        if (numero_cilindros > 0 && !createdCylinders) {
          // Determine test days based on edadGarantia for cylinders (FC), mirroring the SQL function
          let fcTestDays: number[];
          switch (edadGarantia) {
            case 1: fcTestDays = [1, 1, 3]; break;
            case 3: fcTestDays = [1, 1, 3, 3]; break;
            case 7: fcTestDays = [1, 3, 7, 7]; break;
            case 14: fcTestDays = [3, 7, 14, 14]; break;
            case 28: fcTestDays = [7, 14, 28, 28]; break;
            default: fcTestDays = [7, 14, 28, 28]; // Default to 28-day logic
          }

          console.log(`Fallback: Creating cylinders with test days: [${fcTestDays.join(', ')}]`);
          
          // Create cylinder samples (N cylinders * number of test days)
          for (let i = 0; i < numero_cilindros; i++) {
            for (let j = 0; j < fcTestDays.length; j++) {
              const daysToAdd = fcTestDays[j];
              
              // Calculate test date by adding days to the base date (in YYYY-MM-DD format)
              const testDate = createSafeDate(sampleDateString)!;
              testDate.setDate(testDate.getDate() + daysToAdd);
              
              const sampleId = uuidv4();
              const identification = `${clasificacion}-${sampleDateString.replace(/-/g, '')}` + 
                                    `-${String(sampleCount).padStart(3, '0')}`;

              samplesToCreate.push({
                id: sampleId,
                muestreo_id: muestreo.id,
                tipo_muestra: 'CILINDRO',
                identificacion: identification,
                fecha_programada_ensayo: formatDate(testDate, 'yyyy-MM-dd'),
                estado: 'PENDIENTE',
                created_at: new Date().toISOString()
              });

              sampleCount++;
            }
          }
        }

        // Create beam samples directly if SQL function failed
        if (numero_vigas > 0 && !createdBeams) {
          // Beams use different test days according to the MR table
          let mrTestDays: number[];
          switch (edadGarantia) {
            case 1: mrTestDays = [1, 1, 3]; break;
            case 3: mrTestDays = [1, 3, 3]; break;
            case 7: mrTestDays = [3, 7, 7]; break;
            case 14: mrTestDays = [7, 14, 14]; break;
            case 28: mrTestDays = [7, 28, 28]; break; // Note: For MR it's [7,28,28] not [7,14,28,28]
            default: mrTestDays = [7, 28, 28];
          }

          console.log(`Fallback: Creating beams with test days: [${mrTestDays.join(', ')}]`);
          
          // Create beam samples (N beams * 3 test days)
          const beamClasificacion = 'MR';
          for (let i = 0; i < numero_vigas; i++) {
            for (let j = 0; j < mrTestDays.length; j++) {
              const daysToAdd = mrTestDays[j];
              
              // Calculate test date by adding days to the base date (in YYYY-MM-DD format)
              const testDate = createSafeDate(sampleDateString)!;
              testDate.setDate(testDate.getDate() + daysToAdd);
              
              const sampleId = uuidv4();
              const identification = `${beamClasificacion}-${sampleDateString.replace(/-/g, '')}` + 
                                     `-${String(sampleCount).padStart(3, '0')}`;

              samplesToCreate.push({
                id: sampleId,
                muestreo_id: muestreo.id,
                tipo_muestra: 'VIGA',
                identificacion: identification,
                fecha_programada_ensayo: formatDate(testDate, 'yyyy-MM-dd'),
                estado: 'PENDIENTE',
                created_at: new Date().toISOString()
              });
              sampleCount++;
            }
          }
        }

        if (samplesToCreate.length > 0) {
          console.log(`Fallback: Creating ${samplesToCreate.length} samples directly via supabase insert`);
          const { error: insertError } = await supabase
            .from('muestras')
            .insert(samplesToCreate);
            
          if (insertError) {
            console.error('Error creating samples directly:', insertError);
          } else {
            console.log(`Successfully created ${samplesToCreate.length} samples directly`);
            
            // Create alerts for each sample
            const alertsToCreate = samplesToCreate.map(sample => {
              // Calculate alert date (one day before test date)
              const testDate = createSafeDate(sample.fecha_programada_ensayo)!;
              const alertDate = new Date(testDate);
              alertDate.setDate(testDate.getDate() - 1);
              
              return {
                muestra_id: sample.id,
                fecha_alerta: formatDate(alertDate, 'yyyy-MM-dd'),
                estado: 'PENDIENTE',
                created_at: new Date().toISOString()
              };
            });
            
            if (alertsToCreate.length > 0) {
              console.log(`Creating ${alertsToCreate.length} alert records`);
              const { error: alertError } = await supabase
                .from('alertas_ensayos')
                .insert(alertsToCreate);
                
              if (alertError) {
                console.error('Error creating alerts:', alertError);
              } else {
                console.log(`Successfully created ${alertsToCreate.length} alerts`);
              }
            }
          }
        }
      } else if (count && count > 0) {
        console.log(`SQL function successfully created ${count} samples, skipping fallback creation`);
      }
    }
    
    // Return the ID of the newly created muestreo
    return muestreo.id;
  } catch (error) {
    console.error('Error in createMuestreoWithSamples:', error);
    throw new Error('Error al crear muestreo y muestras');
  }
}

export default function NuevoMuestreoPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
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
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [remisionSearchTerm, setRemisionSearchTerm] = useState('');
  
  // Add state for storing previous filter state
  const [previousStep, setPreviousStep] = useState<number | null>(null);
  
  // Initialize form with default values
  const form = useForm<MuestreoFormValues>({
    resolver: zodResolver(muestreoFormSchema),
    defaultValues: {
      fecha_muestreo: new Date(),
      numero_muestreo: 1,
      planta: 'P1',
      revenimiento_sitio: 10,
      masa_unitaria: 2400,
      temperatura_ambiente: 25,
      temperatura_concreto: 30,
      numero_cilindros: 1,
      numero_vigas: 0,
    },
  });

  // Cargar órdenes al montar el componente
  useEffect(() => {
    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        // Using a subquery to only include orders that have remisiones of type CONCRETO
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            clients:client_id(business_name),
            remisiones!inner(id, tipo_remision, remision_number)
          `)
          .in('order_status', ['created', 'validated', 'scheduled'])
          .eq('remisiones.tipo_remision', 'CONCRETO')
          .order('delivery_date', { ascending: false });
        
        if (error) throw error;
        
        // Remove duplicate orders (an order may have multiple remisiones)
        const uniqueOrders = Array.from(
          new Map(data.map(order => [order.id, order])).values()
        );
        
        console.log('Órdenes con remisiones cargadas:', uniqueOrders.length);
        setOrders(uniqueOrders);
        setFilteredOrders(uniqueOrders);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    
    loadOrders();
  }, []);

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
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
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
  }, [orders, searchTerm, dateRange]);

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
          construction_name: remision.orders?.construction_site || 'N/A'
        })) || [];
        
        console.log('Remisiones cargadas:', remisionesWithClientInfo.length);
        setRemisiones(remisionesWithClientInfo);
        
        // Apply search term immediately if it exists
        if (remisionSearchTerm) {
          const searchLower = remisionSearchTerm.toLowerCase();
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
  }, [selectedOrder, remisionSearchTerm]);

  // Filter remisiones when search term changes
  useEffect(() => {
    if (!remisiones.length) return;
    
    if (!remisionSearchTerm) {
      setFilteredRemisiones(remisiones);
      return;
    }
    
    const searchLower = remisionSearchTerm.toLowerCase();
    const filtered = remisiones.filter(remision => 
      (remision.remision_number && remision.remision_number.toString().includes(searchLower)) ||
      (remision.client_name && remision.client_name.toLowerCase().includes(searchLower)) ||
      (remision.construction_name && remision.construction_name.toLowerCase().includes(searchLower)) ||
      (remision.recipe?.recipe_code && remision.recipe.recipe_code.toLowerCase().includes(searchLower))
    );
    
    setFilteredRemisiones(filtered);
  }, [remisiones, remisionSearchTerm]);

  // Modify the active step change handling to preserve filters
  const handleStepChange = (newStep: number) => {
    // Store the previous step before changing
    setPreviousStep(activeStep);
    setActiveStep(newStep);
  };

  // Update the handleOrderSelected function to pass search term to remisiones
  const handleOrderSelected = (orderId: string) => {
    setSelectedOrder(orderId);
    setSelectedRemision(null);
    
    // Pass the search term from order filter to remisiones filter if it exists
    if (searchTerm) {
      setRemisionSearchTerm(searchTerm);
    }
    
    // Navigate to the next step
    handleStepChange(1);
  };

  const handleRemisionSelected = (remision: any) => {
    setSelectedRemision(remision);
    
    if (remision?.id) {
      // Set the remision_id in the form
      form.setValue('remision_id', remision.id);
      
      // Obtener la planta de la remisión si está disponible
      if (remision.planta) {
        form.setValue('planta', remision.planta);
      }
      
      // Set the fecha_muestreo from the remision fecha
      if (remision.fecha) {
        // Parse the date string to a Date object for the form
        // Use explicit year/month/day creation to avoid timezone issues
        const [year, month, day] = remision.fecha.split('-').map((num: string) => parseInt(num, 10));
        // Create date with local timezone (month is 0-indexed in JS Date)
        const fechaDate = new Date(year, month - 1, day, 12, 0, 0);
        form.setValue('fecha_muestreo', fechaDate);
      }
      
      // Advance to the next step automatically
      handleStepChange(2);
    }
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
      
      // Ensure we're using the remision date if available
      let finalData = { ...data };
      if (selectedRemision?.fecha) {
        // Try to ensure date format consistency by creating a new Date from the fecha string
        // Use explicit year/month/day creation to avoid timezone issues
        const [year, month, day] = selectedRemision.fecha.split('-').map((num: string) => parseInt(num, 10));
        // Create date with local timezone (month is 0-indexed in JS Date)
        const remisionDate = new Date(year, month - 1, day, 12, 0, 0);
        finalData.fecha_muestreo = remisionDate;
      }
      
      // Create muestreo and associated samples
      const muestreoId = await createMuestreoWithSamples({
        ...finalData,
        created_by: profile?.id,
      });
      
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
      </div>
      
      <Steps value={activeStep} onChange={handleStepChange}>
        <StepsItem title="Seleccionar Orden" description="Elige la orden de concreto">
          <StepsContent className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Orden</CardTitle>
                <CardDescription>
                  Elige la orden para la que deseas crear el muestreo
                </CardDescription>
                
                {/* Search and Filter UI */}
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="Buscar por cliente, obra, número de orden o remisión"
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex-shrink-0">
                      <DatePickerWithRange
                        value={dateRange}
                        onChange={setDateRange}
                        className="w-auto"
                      />
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="flex-shrink-0"
                      onClick={resetFilters}
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                  
                  {(searchTerm || dateRange?.from) && (
                    <div className="flex flex-wrap gap-2">
                      {searchTerm && (
                        <Badge variant="outline" className="bg-gray-100">
                          Búsqueda: {searchTerm}
                          <button 
                            className="ml-1 hover:text-destructive" 
                            onClick={() => setSearchTerm('')}
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                      {dateRange?.from && dateRange?.to && (
                        <Badge variant="outline" className="bg-gray-100">
                          Fecha: {formatDate(dateRange.from, 'dd/MM/yyyy')} - {formatDate(dateRange.to, 'dd/MM/yyyy')}
                          <button 
                            className="ml-1 hover:text-destructive" 
                            onClick={() => setDateRange(undefined)}
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Cargando órdenes...</span>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay órdenes disponibles</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      No se encontraron órdenes activas con los filtros seleccionados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedOrders).map(([date, ordersGroup]) => (
                      <div key={date} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-gray-500" />
                          <h3 className="font-medium text-lg">
                            {date === 'Sin fecha de entrega' ? date : 
                              (() => {
                                // Parse the date parts directly to avoid timezone issues
                                const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
                                // Create date with explicit year, month (0-indexed), and day
                                const headerDate = new Date(year, month - 1, day, 12, 0, 0);
                                return format(headerDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
                              })()}
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ordersGroup.map((order) => (
                            <Card 
                              key={order.id}
                              className={cn(
                                "cursor-pointer transition-all hover:border-primary",
                                selectedOrder === order.id && "border-primary ring-2 ring-primary ring-opacity-50"
                              )}
                              onClick={() => handleOrderSelected(order.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="bg-primary-50 p-2 rounded-full">
                                    <Package className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{order.order_number || `Orden #${order.id.substring(0, 8)}`}</h4>
                                    <p className="text-sm text-gray-500">
                                      Entrega: {order.delivery_date 
                                        ? formatDate(adjustDateForTimezone(order.delivery_date) || new Date(), 'dd/MM/yyyy') 
                                        : 'Sin fecha'}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-1 mt-3">
                                  <p className="text-sm"><span className="font-medium">Cliente:</span> {order.clients?.business_name || 'N/A'}</p>
                                  <p className="text-sm"><span className="font-medium">Obra:</span> {order.construction_site || 'N/A'}</p>
                                  <p className="text-sm"><span className="font-medium">Monto:</span> {new Intl.NumberFormat('es-MX', {
                                    style: 'currency',
                                    currency: 'MXN'
                                  }).format(order.total_amount || 0)}</p>
                                  <div className="mt-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                                      order.order_status === 'validated' ? 'bg-green-500 text-white' :
                                      order.order_status === 'created' ? 'bg-blue-500 text-white' :
                                      order.order_status === 'scheduled' ? 'bg-purple-500 text-white' :
                                      'bg-gray-500 text-white'
                                    }`}>
                                      {order.order_status === 'validated' ? 'Validada' :
                                       order.order_status === 'created' ? 'Creada' :
                                       order.order_status === 'scheduled' ? 'Programada' : 
                                       order.order_status}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/quality/muestreos')}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => handleStepChange(1)}
                  disabled={!selectedOrder || isLoadingOrders}
                >
                  Continuar
                </Button>
              </CardFooter>
            </Card>
          </StepsContent>
        </StepsItem>
        
        <StepsItem title="Seleccionar Remisión" description="Elige la remisión para muestrear">
          <StepsContent className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Remisión</CardTitle>
                <CardDescription>
                  Elige la remisión para la que deseas crear el muestreo
                </CardDescription>
                
                {/* Remisiones Search UI */}
                <div className="mt-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="Buscar por remisión, cliente o receta"
                        className="pl-9"
                        value={remisionSearchTerm}
                        onChange={(e) => setRemisionSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="flex-shrink-0"
                      onClick={resetRemisionFilters}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRemisiones ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Cargando remisiones...</span>
                  </div>
                ) : filteredRemisiones.length === 0 ? (
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay remisiones disponibles</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      No se encontraron remisiones disponibles para esta orden o con los filtros seleccionados.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRemisiones.map((remision) => (
                      <Card 
                        key={remision.id}
                        className={cn(
                          "cursor-pointer transition-all hover:border-primary",
                          selectedRemision?.id === remision.id && "border-primary ring-2 ring-primary ring-opacity-50"
                        )}
                        onClick={() => handleRemisionSelected(remision)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="bg-primary-50 p-2 rounded-full">
                              <Truck className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold">Remisión #{remision.remision_number}</h4>
                              <p className="text-sm text-gray-500">
                                {remision.fecha ? formatDate(adjustDateForTimezone(remision.fecha) || new Date(), 'dd/MM/yyyy') : 'Sin fecha'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1 mt-3">
                            <p className="text-sm"><span className="font-medium">Volumen:</span> {remision.volumen_fabricado} m³</p>
                            <p className="text-sm"><span className="font-medium">f'c:</span> {remision.recipe?.strength_fc || 'N/A'} kg/cm²</p>
                            <p className="text-sm"><span className="font-medium">Receta:</span> {remision.recipe?.recipe_code || 'N/A'}</p>
                            {remision.conductor && (
                              <p className="text-sm"><span className="font-medium">Conductor:</span> {remision.conductor}</p>
                            )}
                            {remision.unidad && (
                              <p className="text-sm"><span className="font-medium">Unidad:</span> {remision.unidad}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => handleStepChange(0)}
                >
                  Atrás
                </Button>
                <Button 
                  onClick={() => handleStepChange(2)}
                  disabled={!selectedRemision || isLoadingRemisiones}
                >
                  Continuar
                </Button>
              </CardFooter>
            </Card>
          </StepsContent>
        </StepsItem>
        
        <StepsItem title="Datos del Muestreo" description="Completa la información">
          <StepsContent className="py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Información de la Remisión</CardTitle>
                    <CardDescription>
                      Detalles de la remisión seleccionada
                    </CardDescription>
                  </CardHeader>
                  {selectedRemision ? (
                    <CardContent className="space-y-4">
                      <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="font-semibold text-lg mb-3">Remisión #{selectedRemision.remision_number}</h3>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">Unidad</p>
                              <p className="text-sm">{selectedRemision.unidad || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">Conductor</p>
                              <p className="text-sm">{selectedRemision.conductor || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">Receta</p>
                              <p className="text-sm">{selectedRemision.recipe?.recipe_code || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">Volumen</p>
                              <p className="text-sm">{selectedRemision.volumen_fabricado || 'N/A'} m³</p>
                            </div>
                          </div>
                          
                          <hr className="border-gray-200" />
                          
                          <div>
                            <p className="text-sm font-medium">Detalles de la Mezcla</p>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <p className="text-sm"><span className="text-gray-500">f'c:</span> {selectedRemision.recipe?.strength_fc || 'N/A'} kg/cm²</p>
                              <p className="text-sm"><span className="text-gray-500">Rev:</span> {selectedRemision.recipe?.slump || 'N/A'} cm</p>
                              <p className="text-sm"><span className="text-gray-500">TMA:</span> {selectedRemision.recipe?.tma || 'N/A'} mm</p>
                              <p className="text-sm"><span className="text-gray-500">Edad:</span> {selectedRemision.recipe?.age_days || 'N/A'} días</p>
                            </div>
                          </div>
                          
                          <hr className="border-gray-200" />
                          
                          <div>
                            <p className="text-sm font-medium">Cliente/Obra</p>
                            <p className="text-sm">{selectedRemision.client_name || 'N/A'}</p>
                            <p className="text-sm text-gray-500">{selectedRemision.construction_name || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                        <Button 
                          variant="outline"
                          onClick={() => handleStepChange(1)}
                          size="sm"
                        >
                          Cambiar Remisión
                        </Button>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="flex justify-center items-center p-6">
                      <p className="text-gray-500">No hay remisión seleccionada</p>
                    </CardContent>
                  )}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="fecha_muestreo"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>
                                  Fecha de Muestreo 
                                </FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground",
                                          selectedRemision?.fecha && "border-blue-300 bg-blue-50"
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, "PPP", { locale: es })
                                        ) : (
                                          <span>Seleccionar fecha</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
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
                          
                          <FormField
                            control={form.control}
                            name="planta"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Planta</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona la planta" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="P1">Planta 1</SelectItem>
                                    <SelectItem value="P2">Planta 2</SelectItem>
                                    <SelectItem value="P3">Planta 3</SelectItem>
                                    <SelectItem value="P4">Planta 4</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="revenimiento_sitio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Revenimiento en Sitio (cm)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.1"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="masa_unitaria"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Masa Unitaria (kg/m³)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.1"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="temperatura_ambiente"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Temperatura Ambiente (°C)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.1"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="temperatura_concreto"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Temperatura del Concreto (°C)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.1"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <Tabs defaultValue="cilindros" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="cilindros">Cilindros de Prueba</TabsTrigger>
                            <TabsTrigger value="vigas">Vigas de Prueba</TabsTrigger>
                          </TabsList>
                          <TabsContent value="cilindros" className="p-4 border rounded-md mt-2">
                            <FormField
                              control={form.control}
                              name="numero_cilindros"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Número de Cilindros a Elaborar</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="0"
                                      {...field}
                                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Por cada cilindro se generarán múltiples muestras de ensayo según la edad de garantía. Por ejemplo, para f'c a 28 días, cada cilindro genera 4 muestras (días 7, 14, 28 y 28).
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                          <TabsContent value="vigas" className="p-4 border rounded-md mt-2">
                            <FormField
                              control={form.control}
                              name="numero_vigas"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Número de Vigas a Elaborar</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="0"
                                      {...field}
                                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Por cada viga se generarán múltiples muestras de ensayo según la edad de garantía. Por ejemplo, para MR a 28 días, cada viga genera 3 muestras (días 7, 28 y 28).
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                        </Tabs>
                        
                        <div className="space-y-2 mt-4">
                          <h3 className="text-sm font-semibold">Evidencia Fotográfica</h3>
                          <p className="text-sm text-gray-500">
                            La evidencia fotográfica se podrá cargar después de crear el muestreo, en la página de detalle de cada muestra.
                          </p>
                          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm font-medium">Las fotos y documentos se cargarán al registrar los ensayos</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Crea el muestreo primero para poder agregar evidencia a cada muestra
                            </p>
                          </div>
                        </div>
                        
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
    </div>
  );
} 