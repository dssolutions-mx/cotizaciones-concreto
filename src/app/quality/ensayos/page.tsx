'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths,
  subMonths,
  format as formatDateFns,
  isSameMonth,
  isToday
} from 'date-fns';
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
  ChevronLeft,
  ArrowDownCircle,
  CircleDot,
  LayoutGrid,
  List
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
import { cn } from '@/lib/utils';

export default function EnsayosPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const [muestras, setMuestras] = useState<MuestraWithRelations[]>([]);
  const [filteredMuestras, setFilteredMuestras] = useState<MuestraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  
  // Fetch pending tests
  useEffect(() => {
    const loadPendingEnsayos = async () => {
      // Si no hay planta seleccionada, limpiar datos
      if (!currentPlant?.id) {
        setMuestras([]);
        setFilteredMuestras([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchMuestrasPendientes({
          plant_id: currentPlant.id
        });
        setMuestras(data);
        
        // Apply initial date filter
        filterMuestrasByDate(data, selectedDate);
      } catch (err) {
        console.error('Error loading pending tests:', err);
        setError('Error al cargar los ensayos pendientes');
        setMuestras([]);
        setFilteredMuestras([]);
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

  // Get samples for a specific day
  const getSamplesForDay = (date: Date): MuestraWithRelations[] => {
    return muestras.filter(muestra => {
      if (!muestra.fecha_programada_ensayo) return false;
      const programmedDate = createSafeDate(muestra.fecha_programada_ensayo);
      return programmedDate && isSameDay(programmedDate, date);
    });
  };

  // Generate calendar days for current month view
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Start on Sunday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
    filterMuestrasByDate(muestras, today);
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

  // Render calendar view
  const renderCalendarView = () => {
    const calendarDays = generateCalendarDays();
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              {formatDateFns(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + formatDateFns(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {/* Week day headers */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm text-gray-600 py-2 border-b"
              >
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const samplesForDay = getSamplesForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedDate(day);
                    filterMuestrasByDate(muestras, day);
                  }}
                  className={cn(
                    "min-h-[120px] max-h-[120px] border rounded-lg p-2 cursor-pointer transition-all hover:shadow-md flex flex-col",
                    !isCurrentMonth && "bg-gray-50 text-gray-400",
                    isCurrentMonth && "bg-white",
                    isTodayDate && "ring-2 ring-blue-500 bg-blue-50",
                    isSelected && "ring-2 ring-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className={cn(
                      "text-sm font-medium",
                      isTodayDate && "text-blue-600 font-bold"
                    )}>
                      {formatDateFns(day, 'd')}
                    </span>
                    {samplesForDay.length > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 px-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        {samplesForDay.length}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Show all samples with scroll */}
                  <div className="space-y-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                    {samplesForDay.map((muestra) => {
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
                        <div
                          key={muestra.id}
                          className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded px-2 py-1 text-xs hover:from-blue-100 hover:to-blue-200 transition-colors flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateEnsayo(muestra.id);
                          }}
                        >
                          <div className="font-medium text-blue-900 truncate">
                            {muestra.identificacion || `Muestra ${muestra.id.substring(0, 6)}`}
                          </div>
                          <div className="text-blue-700 flex items-center gap-1">
                            <span className="truncate">
                              {muestra.muestreo?.remision?.remision_number || 'N/A'}
                            </span>
                            {ageInDays !== null && (
                              <span className="font-semibold">· {ageInDays}d</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render list view (original)
  const renderListView = () => {
    return (
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
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Ensayos Pendientes</h1>
            <div className="flex items-center gap-2">
              <p className="text-gray-500">
                Gestiona los ensayos programados para cilindros y vigas
              </p>
              {currentPlant && (
                <>
                  <span className="text-gray-400">•</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {currentPlant.name}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="flex items-center gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
            </Button>
          </div>
        </div>
      </div>

      {!currentPlant ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay planta seleccionada
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Por favor, selecciona una planta en el selector de la parte superior para ver los ensayos pendientes.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
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
      ) : (
        <>
          {viewMode === 'calendar' ? (
            <div className="space-y-6">
              {renderCalendarView()}
              
              {/* Selected day details */}
              {selectedDate && filteredMuestras.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CircleDot className="h-5 w-5 text-primary" />
                      Ensayos para {formatDate(selectedDate, "d 'de' MMMM, yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <>
              <DateFilter selectedDate={selectedDate} onDateChange={handleDateSelect} className="mb-4" />
              {renderListView()}
            </>
          )}
        </>
      )}
    </div>
  );
} 