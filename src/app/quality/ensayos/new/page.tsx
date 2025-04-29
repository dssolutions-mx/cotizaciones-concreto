'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  AlertTriangle, 
  ChevronLeft, 
  Save, 
  FileText, 
  Calculator, 
  FileImage
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, createSafeDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  fetchMuestraById, 
  createEnsayo 
} from '@/services/qualityService';
import type { MuestraWithRelations } from '@/types/quality';
import { FileUploader } from '@/components/ui/file-uploader';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';

// Validation schema for the form
const ensayoFormSchema = z.object({
  muestra_id: z.string().min(1, 'El ID de la muestra es requerido'),
  fecha_ensayo: z.date({
    required_error: 'La fecha del ensayo es requerida',
  }),
  carga_kg: z.number()
    .min(0, 'La carga debe ser un número positivo')
    .max(500000, 'La carga parece demasiado alta'),
  resistencia_calculada: z.number()
    .min(0, 'La resistencia debe ser un número positivo'),
  porcentaje_cumplimiento: z.number()
    .min(0, 'El porcentaje debe ser un número positivo'),
  tiene_evidencias: z.boolean().default(false),
  observaciones: z.string().optional(),
});

type EnsayoFormValues = z.infer<typeof ensayoFormSchema>;

export default function NuevoEnsayoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [muestra, setMuestra] = useState<MuestraWithRelations | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get muestra_id from query
  const muestraId = searchParams.get('muestra');
  
  // Initialize form with default values
  const form = useForm<EnsayoFormValues>({
    resolver: zodResolver(ensayoFormSchema),
    defaultValues: {
      fecha_ensayo: new Date(),
      carga_kg: 0,
      resistencia_calculada: 0,
      porcentaje_cumplimiento: 0,
      tiene_evidencias: false,
      observaciones: '',
    },
  });

  // Set muestra_id from query param
  useEffect(() => {
    if (muestraId) {
      form.setValue('muestra_id', muestraId);
      fetchMuestraDetails(muestraId);
    } else {
      setLoading(false);
      setError('No se especificó una muestra para ensayar');
    }
  }, [muestraId, form]);

  // Fetch muestra details
  const fetchMuestraDetails = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchMuestraById(id);
      setMuestra(data);
      
    } catch (err) {
      console.error('Error fetching muestra details:', err);
      setError('Error al cargar los detalles de la muestra');
    } finally {
      setLoading(false);
    }
  };

  // Calculate resistance when carga_kg changes
  const handleCargaChange = (value: number) => {
    // Set carga_kg in the form
    form.setValue('carga_kg', value);
    
    // Calculate resistencia_calculada based on sample type and area
    if (muestra) {
      let area = 0;
      
      // Default to standard cylinder area (15 cm diameter)
      if (muestra.tipo_muestra === 'CILINDRO') {
        // Area of a 15 cm diameter cylinder in cm²
        area = Math.PI * 7.5 * 7.5;
      } else if (muestra.tipo_muestra === 'VIGA') {
        // For beams, assume standard 15x15 cm cross section
        area = 15 * 15;
      }
      
      if (area > 0) {
        const resistencia = value / area;
        form.setValue('resistencia_calculada', parseFloat(resistencia.toFixed(2)));
        
        // Calculate porcentaje_cumplimiento if we have recipe strength info
        const targetStrength = muestra.muestreo?.remision?.recipe?.strength_fc || 0;
        if (targetStrength > 0) {
          const porcentaje = (resistencia / targetStrength) * 100;
          form.setValue('porcentaje_cumplimiento', parseFloat(porcentaje.toFixed(2)));
        }
      }
    }
  };

  // Handle file selection
  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    form.setValue('tiene_evidencias', files.length > 0);
  };

  // Handle form submission
  const onSubmit = async (data: EnsayoFormValues) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      if (!muestra?.muestreo_id) {
        setSubmitError('No se pudo obtener la información completa del muestreo.');
        return;
      }
      
      // Remove profile.id since it will be fetched from the session in the service
      await createEnsayo({
        muestra_id: data.muestra_id,
        fecha_ensayo: data.fecha_ensayo,
        carga_kg: data.carga_kg,
        resistencia_calculada: data.resistencia_calculada,
        porcentaje_cumplimiento: data.porcentaje_cumplimiento,
        observaciones: data.observaciones || '',
        evidencia_fotografica: data.tiene_evidencias ? selectedFiles : []
      });
      
      // Show success message and redirect after a delay
      setSubmitSuccess(true);
      
      setTimeout(() => {
        // Redirect to muestreo detail page
        if (muestra?.muestreo?.id) {
          router.push(`/quality/muestreos/${muestra.muestreo.id}`);
        } else {
          router.push('/quality/ensayos');
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error creating ensayo:', error);
      setSubmitError('Ocurrió un error al guardar el ensayo. Por favor, intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify allowed roles
  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE'];
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
            No tienes permiso para registrar ensayos de laboratorio.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.push('/quality/ensayos')}
            className="mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a Ensayos
          </Button>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/quality/ensayos')}>
              Volver a Ensayos Pendientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/quality/ensayos')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Ensayos
        </Button>
        
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Nuevo Ensayo</h1>
        <p className="text-gray-500">
          Registra los resultados del ensayo para la muestra seleccionada
        </p>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Cargando detalles de la muestra...</span>
        </div>
      ) : muestra ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Detalles de la Muestra</CardTitle>
                <CardDescription>
                  Información sobre la muestra a ensayar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">ID de Muestra</h3>
                    <p className="mt-1">{muestra.identificacion || muestra.id.substring(0, 8)}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Tipo de Muestra</h3>
                    <Badge variant="outline" className="mt-1">
                      {muestra.tipo_muestra === 'CILINDRO' ? 'Cilindro' : 'Viga'}
                    </Badge>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Remisión</h3>
                    <p className="mt-1">{muestra.muestreo?.remision?.remision_number || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Fecha de Muestreo</h3>
                    <p className="mt-1">
                      {muestra.muestreo?.fecha_muestreo 
                        ? formatDate(muestra.muestreo.fecha_muestreo, 'PPP')
                        : 'N/A'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Fecha Programada</h3>
                    <p className="mt-1">
                      {muestra.fecha_programada_ensayo 
                        ? formatDate(muestra.fecha_programada_ensayo, 'PPP')
                        : 'N/A'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Diseño</h3>
                    <p className="mt-1">
                      {muestra.muestreo?.remision?.recipe?.recipe_code || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">f'c Objetivo</h3>
                    <p className="mt-1 font-semibold">
                      {muestra.muestreo?.remision?.recipe?.strength_fc || 'N/A'} kg/cm²
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Registro de Ensayo
                </CardTitle>
                <CardDescription>
                  Ingresa los datos obtenidos del ensayo de laboratorio
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitSuccess ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md">
                    <div className="flex items-center">
                      <div className="mr-3 bg-green-100 p-2 rounded-full">
                        <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Ensayo guardado correctamente</p>
                        <p className="text-sm">Redirigiendo...</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fecha_ensayo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha del Ensayo</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date" 
                                  {...field}
                                  value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                                  onChange={(e) => field.onChange(new Date(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="carga_kg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Carga de Ruptura (kg)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  value={field.value === 0 ? '' : field.value}
                                  onChange={(e) => handleCargaChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Carga máxima alcanzada durante el ensayo
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="resistencia_calculada"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Resistencia (kg/cm²)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  value={field.value === 0 ? '' : field.value}
                                  readOnly 
                                  className="bg-gray-50"
                                />
                              </FormControl>
                              <FormDescription>
                                Calculada automáticamente
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="porcentaje_cumplimiento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                % de Cumplimiento
                                <span className={cn(
                                  "ml-2 text-sm font-medium px-2 py-0.5 rounded-md",
                                  field.value >= 100 
                                    ? "bg-green-100 text-green-800" 
                                    : field.value >= 80 
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                )}>
                                  {field.value === 0 ? '-' : `${field.value}%`}
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  value={field.value === 0 ? '' : field.value}
                                  readOnly 
                                  className="bg-gray-50"
                                />
                              </FormControl>
                              <FormDescription>
                                Porcentaje con respecto al f'c de diseño
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="tiene_evidencias"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel>Incluir evidencia fotográfica</FormLabel>
                                <FormDescription>
                                  Agrega fotos del espécimen ensayado
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        {form.watch('tiene_evidencias') && (
                          <div className="border border-dashed rounded-md p-4">
                            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                              <FileImage className="h-4 w-4 text-blue-500" />
                              Evidencia fotográfica
                            </h3>
                            <FileUploader
                              accept=".jpg,.jpeg,.png"
                              maxFiles={5}
                              maxSize={5 * 1024 * 1024} // 5MB
                              onFilesSelected={handleFilesSelected}
                            />
                          </div>
                        )}
                        
                        <FormField
                          control={form.control}
                          name="observaciones"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Observaciones</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Ingresa cualquier observación o anomalía durante el ensayo..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {submitError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                          <div className="flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                            <span>{submitError}</span>
                          </div>
                        </div>
                      )}
                      
                      <CardFooter className="flex justify-end px-0 pb-0">
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
                              Guardar Ensayo
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Muestra no encontrada</h3>
            <p className="text-gray-600 mb-4">No se encontró la muestra con el ID especificado.</p>
            <Button onClick={() => router.push('/quality/ensayos')}>
              Volver a Ensayos Pendientes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 