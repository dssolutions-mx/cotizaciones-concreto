import React, { useState, useEffect } from 'react';
import { format, isToday, isTomorrow, isYesterday, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Bell, 
  Calendar,
  ChevronRight,
  Check,
  Clock,
  AlertTriangle,
  X,
  CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { fetchMuestrasPendientes, updateAlertaEstado } from '@/services/qualityMuestraService';
import { MuestraWithRelations } from '@/types/quality';
import { useToast } from '@/components/ui/use-toast';
import { DateFilter } from '@/components/ui/DateFilter';
import 'react-day-picker/dist/style.css';
import { DayPicker } from 'react-day-picker';
import * as Popover from '@radix-ui/react-popover';

export default function AlertasEnsayos() {
  const [alertas, setAlertas] = useState<MuestraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const cargarAlertas = async () => {
    try {
      setLoading(true);
      if (!selectedDate) {
        setAlertas([]);
        return;
      }
      // Obtener muestras pendientes SOLO para la fecha seleccionada
      const muestras = await fetchMuestrasPendientes({
        fechaDesde: selectedDate,
        fechaHasta: selectedDate
      });
      // Ordenar por fecha más cercana primero
      const ordenadas = muestras.sort((a, b) => {
        const fechaA = a.fecha_programada_ensayo ? new Date(a.fecha_programada_ensayo) : new Date();
        const fechaB = b.fecha_programada_ensayo ? new Date(b.fecha_programada_ensayo) : new Date();
        return fechaA.getTime() - fechaB.getTime();
      });
      setAlertas(ordenadas);
    } catch (error) {
      console.error('Error al cargar alertas:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las alertas de ensayos",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, [selectedDate]);

  const marcarComoVista = async (muestraId: string) => {
    try {
      await updateAlertaEstado(muestraId, 'VISTA');
      setAlertas(alertas.filter(alerta => alerta.id !== muestraId));
      toast({
        title: "Alerta marcada como vista",
        description: "La alerta ha sido eliminada de su lista",
      });
    } catch (error) {
      console.error('Error al actualizar alerta:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado de la alerta",
      });
    }
  };

  // Formatear fecha para mostrar
  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    
    if (isToday(date)) {
      return 'Hoy';
    } else if (isTomorrow(date)) {
      return 'Mañana';
    } else if (isYesterday(date)) {
      return 'Ayer';
    } else {
      return format(date, 'EEE dd MMM', { locale: es });
    }
  };

  // Dividir alertas por tipo (hoy, atrasadas, próximas)
  const alertasAtrasadas = alertas.filter(alerta => {
    const fecha = alerta.fecha_programada_ensayo ? new Date(alerta.fecha_programada_ensayo) : null;
    return fecha && fecha < new Date() && !isToday(fecha);
  });
  
  const alertasHoy = alertas.filter(alerta => {
    const fecha = alerta.fecha_programada_ensayo ? new Date(alerta.fecha_programada_ensayo) : null;
    return fecha && isToday(fecha);
  });
  
  const alertasProximas = alertas.filter(alerta => {
    const fecha = alerta.fecha_programada_ensayo ? new Date(alerta.fecha_programada_ensayo) : null;
    return fecha && fecha > new Date() && !isToday(fecha);
  });

  return (
    <div className="bg-gray-50 p-6 rounded-lg @container">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alertas de Ensayos
          </h2>
          <p className="text-sm text-gray-500">Muestras pendientes de realizar ensayos</p>
        </div>
        
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button 
              variant="outline"
              className="w-full sm:w-auto flex items-center gap-2 px-4"
            >
              <CalendarIcon className="h-4 w-4" />
              {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content 
              className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 z-50"
              sideOffset={5}
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={es}
                className="p-2"
                classNames={{
                  day_selected: 'bg-green-600 text-white',
                  day_today: 'bg-gray-100 font-bold',
                  button_reset: 'hidden'
                }}
                footer={
                  <div className="pt-2 text-center text-sm text-gray-500">
                    {selectedDate && (
                      <p>Has seleccionado {format(selectedDate, 'PPP', { locale: es })}</p>
                    )}
                  </div>
                }
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {loading ? (
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
              <span className="ml-3 text-gray-500">Cargando alertas...</span>
            </div>
          </CardContent>
        </Card>
      ) : alertas.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Bell className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">No hay alertas pendientes</h3>
            <p className="text-gray-500 max-w-md">
              No se encontraron ensayos programados para la fecha seleccionada.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setSelectedDate(new Date())}
            >
              Ver ensayos de hoy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Panel de Alertas Atrasadas */}
          {alertasAtrasadas.length > 0 && (
            <Card className="shadow-sm overflow-hidden border-red-200">
              <CardHeader className="bg-red-50 py-3 px-4 border-b border-red-200">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Ensayos Atrasados ({alertasAtrasadas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-red-100">
                <div className="max-h-[250px] overflow-y-auto">
                  {alertasAtrasadas.map((alerta) => (
                    <div key={alerta.id} className="p-4 hover:bg-red-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="destructive" className="h-8 w-8 rounded-full flex items-center justify-center p-0 flex-shrink-0">
                            <AlertTriangle className="h-4 w-4" />
                          </Badge>
                          <div>
                            <p className="font-medium text-gray-900">{alerta.identificacion}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Planta: {alerta.muestreo?.planta} | Muestra: {alerta.tipo_muestra}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center text-red-600">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-medium">
                                  {formatearFecha(alerta.fecha_programada_ensayo || '')}
                                </span>
                              </div>
                              <Link href={`/quality/ensayos/new?muestra=${alerta.id}`}>
                                <Button size="sm" className="h-7 text-xs">
                                  Registrar Ensayo
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600" 
                          onClick={() => marcarComoVista(alerta.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Panel de Alertas para Hoy */}
          {alertasHoy.length > 0 && (
            <Card className="shadow-sm overflow-hidden border-amber-200">
              <CardHeader className="bg-amber-50 py-3 px-4 border-b border-amber-200">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <Clock className="h-4 w-4" />
                  Ensayos para Hoy ({alertasHoy.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-amber-100">
                <div className="max-h-[250px] overflow-y-auto">
                  {alertasHoy.map((alerta) => (
                    <div key={alerta.id} className="p-4 hover:bg-amber-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center p-0 border-amber-400 bg-amber-100 flex-shrink-0">
                            <Clock className="h-4 w-4 text-amber-600" />
                          </Badge>
                          <div>
                            <p className="font-medium text-gray-900">{alerta.identificacion}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Planta: {alerta.muestreo?.planta} | Muestra: {alerta.tipo_muestra}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center text-amber-600">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-medium">
                                  {formatearFecha(alerta.fecha_programada_ensayo || '')}
                                </span>
                              </div>
                              <Link href={`/quality/ensayos/new?muestra=${alerta.id}`}>
                                <Button size="sm" className="h-7 text-xs">
                                  Registrar Ensayo
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600" 
                          onClick={() => marcarComoVista(alerta.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Panel de Alertas Próximas */}
          {alertasProximas.length > 0 && (
            <Card className="shadow-sm overflow-hidden border-blue-200 lg:col-span-2">
              <CardHeader className="bg-blue-50 py-3 px-4 border-b border-blue-200">
                <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                  <Calendar className="h-4 w-4" />
                  Próximos Ensayos ({alertasProximas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-blue-100 max-h-[250px] overflow-y-auto">
                  {alertasProximas.map((alerta) => (
                    <div key={alerta.id} className="p-4 hover:bg-blue-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="h-8 w-8 rounded-full flex items-center justify-center p-0 border-blue-400 bg-blue-100 flex-shrink-0">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </Badge>
                          <div>
                            <p className="font-medium text-gray-900">{alerta.identificacion}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Planta: {alerta.muestreo?.planta} | Muestra: {alerta.tipo_muestra}
                            </p>
                            <div className="flex items-center mt-2">
                              <div className="flex items-center text-blue-600">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-medium">
                                  {formatearFecha(alerta.fecha_programada_ensayo || '')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600" 
                          onClick={() => marcarComoVista(alerta.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <Link href="/quality/ensayos">
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            Ver todos los ensayos
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-center font-medium text-gray-700">Cargando...</p>
          </div>
        </div>
      )}
    </div>
  );
} 