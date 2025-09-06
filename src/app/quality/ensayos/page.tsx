'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  CalendarDays, 
  ChevronRight, 
  ArrowDownCircle,
  CircleDot
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { fetchMuestrasPendientes } from '@/services/qualityMuestraService';
import type { MuestraWithRelations } from '@/types/quality';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { DateFilter } from '@/components/ui/DateFilter';
import { DayPicker, DayProps as RDPDayProps, Day as DefaultDay } from 'react-day-picker';
import type { Modifiers } from 'react-day-picker';
import { formatDate, createSafeDate } from '@/lib/utils';
import { usePlantContext } from '@/contexts/PlantContext';

export default function EnsayosPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const [muestras, setMuestras] = useState<MuestraWithRelations[]>([]);
  const [filteredMuestras, setFilteredMuestras] = useState<MuestraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Fetch pending tests
  useEffect(() => {
    const loadPendingEnsayos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchMuestrasPendientes({
          plant_id: currentPlant?.id
        });
        setMuestras(data);
        
        // Apply initial date filter
        filterMuestrasByDate(data, selectedDate);
      } catch (err) {
        console.error('Error loading pending tests:', err);
        setError('Error al cargar los ensayos pendientes');
      } finally {
        setLoading(false);
      }
    };
    
    loadPendingEnsayos();
  }, [currentPlant?.id]);

  // Filter samples by selected date
  const filterMuestrasByDate = (data: MuestraWithRelations[] = muestras, date: Date | undefined) => {
    const filtered = date 
      ? data.filter(muestra => {
          const programmedDate = muestra.fecha_programada_ensayo
            ? createSafeDate(muestra.fecha_programada_ensayo)
            : null;
          return programmedDate && isSameDay(programmedDate, date);
        })
      : data;
    setFilteredMuestras(filtered);
  };

  // Handle date selection from calendar
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    filterMuestrasByDate(muestras, date);
  };

  // Navigate to sample detail to create test
  const handleCreateEnsayo = (muestraId: string) => {
    router.push(`/quality/ensayos/new?muestra=${muestraId}`);
  };

  // Get highlight dates for calendar (dates with pending tests)
  const getHighlightedDates = () => {
    const uniqueDates = new Set<string>();
    
    muestras.forEach(muestra => {
      if (muestra.fecha_programada_ensayo) {
        const safeDate = createSafeDate(muestra.fecha_programada_ensayo);
        if (safeDate) {
          const dateString = safeDate.toISOString().split('T')[0];
          uniqueDates.add(dateString);
        }
      }
    });
    
    return Array.from(uniqueDates).map(dateStr => new Date(dateStr));
  };
  
  // Check if a date has pending tests
  const hasPendingTests = (date: Date) => {
    return muestras.some(muestra => {
      if (!muestra.fecha_programada_ensayo) return false;
      const programmedDate = createSafeDate(muestra.fecha_programada_ensayo);
      return programmedDate && isSameDay(programmedDate, date);
    });
  };

  // Get count of pending tests for a day
  const getPendingTestsCount = (date: Date) => {
    return muestras.filter(muestra => {
      if (!muestra.fecha_programada_ensayo) return false;
      const programmedDate = createSafeDate(muestra.fecha_programada_ensayo);
      return programmedDate && isSameDay(programmedDate, date);
    }).length;
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
            No tienes permiso para acceder a los ensayos de laboratorio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Ensayos Pendientes</h1>
        <p className="text-gray-500">
          Gestiona los ensayos programados para cilindros y vigas
        </p>
      </div>
      <DateFilter selectedDate={selectedDate} onDateChange={handleDateSelect} className="mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Calendario de Ensayos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DatePicker 
                date={selectedDate} 
                setDate={handleDateSelect} 
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-primary" />
                Ensayos Programados para {formatDate(selectedDate || new Date(), "d 'de' MMMM, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-gray-600">Cargando ensayos pendientes...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                    <span>{error}</span>
                  </div>
                </div>
              ) : filteredMuestras.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No hay ensayos programados</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    No hay ensayos programados para la fecha seleccionada. Selecciona otra fecha en el calendario.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Muestra</TableHead>
                      <TableHead>Muestreo</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMuestras.map((muestra) => {
                      // Calculate age in days
                      const muestreoDate = muestra.muestreo?.fecha_muestreo 
                        ? createSafeDate(muestra.muestreo.fecha_muestreo) 
                        : null;
                      const testDate = muestra.fecha_programada_ensayo 
                        ? createSafeDate(muestra.fecha_programada_ensayo) 
                        : null;
                      
                      const ageInDays = muestreoDate && testDate
                        ? Math.round((testDate.getTime() - muestreoDate.getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                        
                      return (
                        <TableRow key={muestra.id}>
                          <TableCell>
                            <div className="font-medium">
                              {muestra.identificacion || `Muestra ${muestra.id.substring(0, 6)}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {muestra.tipo_muestra === 'CILINDRO' ? 'Cilindro' : 'Viga'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {muestra.muestreo?.remision?.remision_number || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {muestra.muestreo?.fecha_muestreo 
                                ? formatDate(muestra.muestreo.fecha_muestreo, 'dd/MM/yyyy') 
                                : 'N/A'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 font-medium">
                              {ageInDays !== null ? `${ageInDays} días` : 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {muestra.muestreo?.remision?.recipe?.recipe_code || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              f'c: {muestra.muestreo?.remision?.recipe?.strength_fc} kg/cm²
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleCreateEnsayo(muestra.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Realizar Ensayo
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 