'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Calendar, 
  User, 
  Building, 
  MapPin,
  Scale,
  Beaker,
  Droplets,
  BarChart3,
  Download,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Calculator
} from 'lucide-react';
import { EstudioAgregados } from '@/types/agregados';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DetalleEstudioAgregadosProps {
  estudio: EstudioAgregados;
  onEditar?: () => void;
  onDescargarPDF?: () => void;
  onCambiarEstado?: (nuevoEstado: EstudioAgregados['estado']) => void;
  soloLectura?: boolean;
}

const ICONOS_ESTADO = {
  borrador: Clock,
  completado: CheckCircle,
  aprobado: CheckCircle,
  rechazado: XCircle
};

const COLORES_ESTADO = {
  borrador: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completado: 'bg-blue-100 text-blue-800 border-blue-200',
  aprobado: 'bg-green-100 text-green-800 border-green-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200'
};

const ETIQUETAS_ESTADO = {
  borrador: 'Borrador',
  completado: 'Completado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

export default function DetalleEstudioAgregados({
  estudio,
  onEditar,
  onDescargarPDF,
  onCambiarEstado,
  soloLectura = false
}: DetalleEstudioAgregadosProps) {
  
  const IconoEstado = ICONOS_ESTADO[estudio.estado];
  
  const formatearFecha = (fecha: string) => {
    return format(new Date(fecha), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
  };

  const renderEncabezadoLaboratorio = () => (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">
          LABORATORIO DE MATERIALES
        </h1>
        <h2 className="text-lg font-semibold text-blue-800">
          ESTUDIO DE AGREGADOS - CARACTERIZACIÓN FÍSICA
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Mina de procedencia:</span>
            <span className="text-right">{estudio.datosGenerales.minaProcedencia}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Ubicación:</span>
            <span className="text-right">{estudio.datosGenerales.ubicacion || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Muestreada por:</span>
            <span className="text-right">{estudio.datosGenerales.muestreaPor || 'N/A'}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Tamaño de la grava:</span>
            <span className="text-right font-mono">
              {estudio.datosGenerales.tamanoGrava} mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Origen de la Grava:</span>
            <span className="text-right">{estudio.datosGenerales.origenGrava || 'N/A'}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Cliente:</span>
            <span className="text-right">{estudio.datosGenerales.cliente}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">ID de la Muestra:</span>
            <span className="text-right font-mono">{estudio.datosGenerales.idMuestra || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Planta de procedencia:</span>
            <span className="text-right">{estudio.datosGenerales.plantaProcedencia}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMasaEspecifica = () => {
    if (!estudio.masaEspecifica) return null;
    
    const me = estudio.masaEspecifica;
    
    return (
      <Card className="border-gray-300">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <Scale className="h-5 w-5" />
            Masa específica (s.s.s. y seca) (Ref. NMX-C-164-ONNCCE-2014)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fórmulas y cálculos */}
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Fórmulas utilizadas:</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div>Me<sub>sss</sub> = A - (B - C)</div>
                  <div>Me<sub>s</sub> = A/V × Me<sub>sss</sub> = 900/340 = 2.65 kg/dm³</div>
                  <div>Me<sub>s</sub> = M<sub>s</sub>/(M<sub>s</sub> + B + C)</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Definiciones:</h4>
                <div className="text-sm space-y-1">
                  <div><strong>A=</strong> Masa de la muestra S.S.S (Masa en el aire). (kg)</div>
                  <div><strong>B=</strong> Masa de la canastilla incluyendo la muestra, dentro del agua. (kg)</div>
                  <div><strong>C=</strong> Masa de canastilla dentro del tanque de agua. (kg)</div>
                  <div><strong>V=</strong> Volumen desplazado de agua en (dm3)</div>
                  <div><strong>Me<sub>sss</sub>=</strong> Masa específica saturada superficialmente seca</div>
                  <div><strong>Me<sub>s</sub>=</strong> Masa específica seca</div>
                  <div><strong>M<sub>s</sub>=</strong> Masa de la muestra seca (kg)</div>
                </div>
              </div>
            </div>
            
            {/* Valores medidos */}
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3">Valores medidos:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>A =</span>
                    <span className="font-mono">{me.a} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>B =</span>
                    <span className="font-mono">{me.b} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>C =</span>
                    <span className="font-mono">{me.c} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>V =</span>
                    <span className="font-mono">{me.v} dm³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>M<sub>s</sub> =</span>
                    <span className="font-mono">{me.ms} kg</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                <h4 className="font-semibold text-yellow-900 mb-3">Resultados calculados:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Me<sub>sss</sub> =</span>
                    <span className="font-mono text-blue-600">{me.messsCalculado} kg/dm³</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Me<sub>s</sub> =</span>
                    <span className="font-mono text-green-600">{me.mesCalculado} kg/dm³</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Me =</span>
                    <span className="font-mono text-purple-600">{me.meCalculado} kg/dm³</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMasaVolumetrica = () => {
    if (!estudio.masaVolumetrica) return null;
    
    const mv = estudio.masaVolumetrica;
    
    return (
      <Card className="border-gray-300">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <Beaker className="h-5 w-5" />
            Masa volumétrica (Ref. NMX-C-073-ONNCCE-2004)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Masa v. suelta:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{mv.masaVSuelta} kg × Factor =</span>
                    <span className="font-mono text-lg font-semibold text-blue-600">
                      {mv.resultadoVSuelta} kg/m³
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3">Masa v. compactada:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{mv.masaVCompactada} kg × Factor =</span>
                    <span className="font-mono text-lg font-semibold text-green-600">
                      {mv.resultadoVCompactada} kg/m³
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-3">Factor calculado:</h4>
              <div className="text-center">
                <span className="text-2xl font-mono font-bold text-yellow-700">
                  {mv.factorCalculado} 1/m³
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAbsorcion = () => {
    if (!estudio.absorcion) return null;
    
    const abs = estudio.absorcion;
    
    return (
      <Card className="border-gray-300">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <Droplets className="h-5 w-5" />
            Absorción (Ref. NMX-C-164-ONNCCE-2014)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Fórmula:</h4>
                <div className="text-center font-mono text-lg">
                  % Absorción = <span className="block mt-2">
                    (masa muestra SSS (g) - masa muestra seca (g)) / masa muestra seca (g) × 100
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Masa muestra SSS:</span>
                  <span className="font-mono">{abs.masaMuestraSSS} g</span>
                </div>
                <div className="flex justify-between">
                  <span>Masa muestra seca:</span>
                  <span className="font-mono">{abs.masaMuestraSeca} g</span>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <h4 className="font-semibold text-green-900 mb-2">% Absorción =</h4>
                <div className="text-4xl font-mono font-bold text-green-600">
                  {abs.porcentajeAbsorcion}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPerdidaPorLavado = () => {
    if (!estudio.perdidaPorLavado) return null;
    
    const ppl = estudio.perdidaPorLavado;
    
    return (
      <Card className="border-gray-300">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <Droplets className="h-5 w-5" />
            Pérdida por lavado (Ref. NMX-C-084-ONNCCE-2018)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">Secado a masa constante</h4>
                <p className="text-sm">{ppl.secadoMasaConstante ? 'Sí' : 'No'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Masa muestra seca "Ms" (g) =</span>
                  <span className="font-mono">{ppl.masaMuestraSeca} g</span>
                </div>
                <div className="flex justify-between">
                  <span>Masa muestra seca lavada "Msl" (g) =</span>
                  <span className="font-mono">{ppl.masaMuestraSecaLavada} g</span>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">Fórmula:</h4>
                <div className="font-mono text-sm text-center">
                  % P × L = (Ms - Msl) / Ms × 100 = 
                  <div className="mt-2 text-lg">
                    {ppl.masaMuestraSeca} - {ppl.masaMuestraSecaLavada} / {ppl.masaMuestraSeca} × 100
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <h4 className="font-semibold text-red-900 mb-2">% P × L =</h4>
                <div className="text-4xl font-mono font-bold text-red-600">
                  {ppl.porcentajePerdida}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGranulometria = () => {
    if (!estudio.granulometria) return null;
    
    const gran = estudio.granulometria;
    
    return (
      <Card className="border-gray-300">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center gap-2 text-center justify-center">
            <BarChart3 className="h-5 w-5" />
            Granulometría (Ref. NMX-C-077-ONNCCE-2019)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabla de datos */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">
                Gráfica Grava {gran.tamanoGrava}
              </h4>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2">No Malla</th>
                      <th className="border border-gray-300 p-2">Retenido g</th>
                      <th className="border border-gray-300 p-2">% Ret.</th>
                      <th className="border border-gray-300 p-2">% Acum.</th>
                      <th className="border border-gray-300 p-2">% Pasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gran.datos.map((dato, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 p-2 text-center font-mono">
                          {dato.noMalla}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono">
                          {dato.retenidoG}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono">
                          {dato.porcentajeRetenido}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono">
                          {dato.porcentajeAcumulado}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono">
                          {dato.porcentajePasa}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-100 font-semibold">
                      <td className="border border-gray-300 p-2 text-center">Total</td>
                      <td className="border border-gray-300 p-2 text-right font-mono">
                        {gran.total}
                      </td>
                      <td className="border border-gray-300 p-2"></td>
                      <td className="border border-gray-300 p-2"></td>
                      <td className="border border-gray-300 p-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Gráfica */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-4 text-center">
                Gráfica Grava {gran.tamanoGrava}
              </h4>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                <div className="text-center text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  <p>Gráfica de granulometría</p>
                  <p className="text-sm">(Se implementará con Chart.js)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Encabezado con acciones */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Estudio de Agregados - Detalle
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Creado: {formatearFecha(estudio.fechaCreacion)}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>Técnico: {estudio.tecnicoResponsable}</span>
            </div>
            <Badge className={COLORES_ESTADO[estudio.estado]}>
              <IconoEstado className="h-3 w-3 mr-1" />
              {ETIQUETAS_ESTADO[estudio.estado]}
            </Badge>
          </div>
        </div>
        
        {!soloLectura && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDescargarPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button variant="outline" onClick={onEditar}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {/* Encabezado del laboratorio */}
      {renderEncabezadoLaboratorio()}

      {/* Estudios realizados */}
      <div className="space-y-6">
        {renderMasaEspecifica()}
        {renderMasaVolumetrica()}
        {renderAbsorcion()}
        {renderPerdidaPorLavado()}
        {renderGranulometria()}
      </div>

      {/* Observaciones */}
      {estudio.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Observaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{estudio.observaciones}</p>
          </CardContent>
        </Card>
      )}

      {/* Información de aprobación */}
      {estudio.estado === 'aprobado' && estudio.supervisorAprobacion && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Aprobado por: {estudio.supervisorAprobacion}
                </span>
              </div>
              <span className="text-sm text-green-700">
                {estudio.fechaAprobacion && formatearFecha(estudio.fechaAprobacion)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


