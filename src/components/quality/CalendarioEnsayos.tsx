'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface MuestraPendiente {
  id: string;
  fecha_ensayo: string;
  hora_ensayo: string;
  tipo_muestra: string;
  cantidad_tiempo: number;
  unidad_tiempo: string;
  diseño: {
    no_muestra: string;
    nombre_muestra: string;
  };
}

interface CalendarioEnsayosProps {
  muestras: MuestraPendiente[];
  onMuestraClick?: (muestra: MuestraPendiente) => void;
}

export default function CalendarioEnsayos({ muestras, onMuestraClick }: CalendarioEnsayosProps) {
  // Agrupar muestras por fecha
  const muestrasPorFecha = useMemo(() => {
    const grupos: { [fecha: string]: MuestraPendiente[] } = {};
    
    muestras.forEach(muestra => {
      const fecha = muestra.fecha_ensayo;
      if (!grupos[fecha]) {
        grupos[fecha] = [];
      }
      grupos[fecha].push(muestra);
    });
    
    return grupos;
  }, [muestras]);

  // Obtener fechas de la semana actual
  const fechasSemana = useMemo(() => {
    const hoy = new Date();
    const inicioSemana = startOfWeek(hoy, { weekStartsOn: 1 }); // Lunes
    const finSemana = endOfWeek(hoy, { weekStartsOn: 1 }); // Domingo
    
    const fechas = [];
    let fechaActual = new Date(inicioSemana);
    
    while (fechaActual <= finSemana) {
      fechas.push(new Date(fechaActual));
      fechaActual = addDays(fechaActual, 1);
    }
    
    return fechas;
  }, []);

  const getStatusColor = (fecha: string) => {
    const today = new Date().toISOString().split('T')[0];
    const fechaEnsayo = new Date(fecha);
    const hoy = new Date(today);
    
    if (fecha === today) return 'border-green-300 bg-green-50';
    if (fechaEnsayo < hoy) return 'border-red-300 bg-red-50';
    return 'border-blue-300 bg-blue-50';
  };

  const getStatusIcon = (fecha: string) => {
    const today = new Date().toISOString().split('T')[0];
    const fechaEnsayo = new Date(fecha);
    const hoy = new Date(today);
    
    if (fecha === today) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (fechaEnsayo < hoy) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-blue-600" />;
  };

  return (
    <Card className="bg-white/90 backdrop-blur border border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendario de Ensayos - Semana Actual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {fechasSemana.map((fecha) => {
            const fechaStr = fecha.toISOString().split('T')[0];
            const muestrasDelDia = muestrasPorFecha[fechaStr] || [];
            const isToday = fechaStr === new Date().toISOString().split('T')[0];
            
            return (
              <Card 
                key={fechaStr} 
                className={`${isToday ? 'ring-2 ring-blue-400' : ''} ${
                  muestrasDelDia.length > 0 ? getStatusColor(fechaStr) : 'bg-gray-50'
                }`}
              >
                <CardContent className="p-3">
                  <div className="text-center mb-2">
                    <div className="text-xs text-gray-500 uppercase">
                      {format(fecha, 'EEE', { locale: es })}
                    </div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {format(fecha, 'd')}
                    </div>
                  </div>
                  
                  {muestrasDelDia.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        {getStatusIcon(fechaStr)}
                        <span className="text-xs font-medium">
                          {muestrasDelDia.length} ensayo(s)
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        {muestrasDelDia.slice(0, 3).map((muestra) => (
                          <div 
                            key={muestra.id}
                            className="bg-white p-2 rounded text-xs cursor-pointer hover:bg-gray-50"
                            onClick={() => onMuestraClick?.(muestra)}
                          >
                            <div className="font-medium truncate">
                              {muestra.diseño.no_muestra}
                            </div>
                            <div className="text-gray-500">
                              {muestra.hora_ensayo}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {muestra.tipo_muestra}
                            </Badge>
                          </div>
                        ))}
                        
                        {muestrasDelDia.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{muestrasDelDia.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs">
                      Sin ensayos
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Leyenda */}
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>Hoy</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-blue-600" />
            <span>Programado</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span>Vencido</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
