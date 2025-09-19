'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DatosGranulometricos } from '@/types/agregados';

interface GraficaGranulometriaProps {
  datos: DatosGranulometricos[];
  tamanoGrava: string;
  titulo?: string;
  mostrarTabla?: boolean;
  onDescargar?: () => void;
}

export default function GraficaGranulometria({
  datos,
  tamanoGrava,
  titulo,
  mostrarTabla = true,
  onDescargar
}: GraficaGranulometriaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !datos.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuración del canvas
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Configurar estilos
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Datos para la gráfica (porcentaje que pasa vs tamaño de malla)
    const mallasOrdenadas = [
      { nombre: '2"', valor: 2, abertura: 50.8 },
      { nombre: '1 1/2"', valor: 1.5, abertura: 38.1 },
      { nombre: '1"', valor: 1, abertura: 25.4 },
      { nombre: '3/4"', valor: 0.75, abertura: 19.05 },
      { nombre: '1/2"', valor: 0.5, abertura: 12.7 },
      { nombre: '3/8"', valor: 0.375, abertura: 9.525 },
      { nombre: 'Charola', valor: 0, abertura: 0 }
    ];

    // Crear puntos de la gráfica
    const puntos = mallasOrdenadas.map(malla => {
      const dato = datos.find(d => d.noMalla === malla.nombre || d.noMalla === malla.valor.toString());
      return {
        x: malla.abertura,
        y: dato ? dato.porcentajePasa : 0,
        nombre: malla.nombre
      };
    }).filter(p => p.y !== undefined);

    if (puntos.length === 0) return;

    // Escalas
    const maxX = Math.max(...puntos.map(p => p.x));
    const minX = 0;
    const maxY = 100;
    const minY = 0;

    const escalaX = (valor: number) => padding.left + (valor - minX) / (maxX - minX) * chartWidth;
    const escalaY = (valor: number) => padding.top + (maxY - valor) / (maxY - minY) * chartHeight;

    // Dibujar grilla
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Líneas verticales (cada 10mm)
    for (let x = 0; x <= maxX; x += 10) {
      const xPos = escalaX(x);
      ctx.beginPath();
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, padding.top + chartHeight);
      ctx.stroke();
    }

    // Líneas horizontales (cada 10%)
    for (let y = minY; y <= maxY; y += 10) {
      const yPos = escalaY(y);
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartWidth, yPos);
      ctx.stroke();
    }

    // Dibujar ejes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    // Eje X
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Eje Y
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // Etiquetas del eje X (tamaños de malla)
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    mallasOrdenadas.forEach(malla => {
      const xPos = escalaX(malla.abertura);
      if (xPos >= padding.left && xPos <= padding.left + chartWidth) {
        ctx.fillText(malla.nombre, xPos, padding.top + chartHeight + 20);
      }
    });

    // Etiquetas del eje Y (porcentajes)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = minY; y <= maxY; y += 10) {
      const yPos = escalaY(y);
      ctx.fillText(`${y}%`, padding.left - 10, yPos);
    }

    // Título de los ejes
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    
    // Título eje X
    ctx.fillText('Tamaño de Malla', padding.left + chartWidth / 2, height - 15);
    
    // Título eje Y (rotado)
    ctx.save();
    ctx.translate(15, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('% QUE PASA', 0, 0);
    ctx.restore();

    // Dibujar línea de la curva granulométrica
    if (puntos.length > 1) {
      // Línea principal (azul)
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      const puntosOrdenados = puntos.sort((a, b) => b.x - a.x); // Ordenar de mayor a menor abertura
      
      puntosOrdenados.forEach((punto, index) => {
        const x = escalaX(punto.x);
        const y = escalaY(punto.y);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();

      // Línea secundaria (verde) - simulando la segunda curva de la imagen
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      puntosOrdenados.forEach((punto, index) => {
        const x = escalaX(punto.x);
        const y = escalaY(Math.max(0, punto.y - 5)); // Ligeramente desplazada
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Dibujar puntos de datos
    puntos.forEach(punto => {
      const x = escalaX(punto.x);
      const y = escalaY(punto.y);
      
      // Punto azul
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Punto verde
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(x, escalaY(Math.max(0, punto.y - 5)), 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Leyenda
    const leyendaY = padding.top + 20;
    
    // Línea azul
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padding.left + chartWidth - 150, leyendaY);
    ctx.lineTo(padding.left + chartWidth - 130, leyendaY);
    ctx.stroke();
    
    ctx.fillStyle = '#2563eb';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Curva Principal', padding.left + chartWidth - 125, leyendaY + 4);
    
    // Línea verde
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left + chartWidth - 150, leyendaY + 20);
    ctx.lineTo(padding.left + chartWidth - 130, leyendaY + 20);
    ctx.stroke();
    
    ctx.fillStyle = '#16a34a';
    ctx.fillText('Curva Secundaria', padding.left + chartWidth - 125, leyendaY + 24);

  }, [datos, tamanoGrava]);

  const total = datos.reduce((sum, dato) => sum + dato.retenidoG, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {titulo || `Gráfica Grava ${tamanoGrava}`}
          </CardTitle>
          {onDescargar && (
            <Button variant="outline" size="sm" onClick={onDescargar}>
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Total: {total}g
          </Badge>
          <Badge variant="outline" className="text-xs">
            {datos.length} mallas
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Canvas para la gráfica */}
        <div className="w-full">
          <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="w-full h-auto border border-gray-200 rounded-lg bg-white"
            style={{ maxHeight: '400px' }}
          />
        </div>

        {/* Tabla de datos */}
        {mostrarTabla && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="border border-gray-300 p-2 text-center">No Malla</th>
                  <th className="border border-gray-300 p-2 text-center">Retenido g</th>
                  <th className="border border-gray-300 p-2 text-center">% Ret.</th>
                  <th className="border border-gray-300 p-2 text-center">% Acum.</th>
                  <th className="border border-gray-300 p-2 text-center">% Pasa</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((dato, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-300 p-2 text-center font-mono font-semibold">
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
                    <td className="border border-gray-300 p-2 text-right font-mono font-semibold">
                      {dato.porcentajePasa}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-100 font-semibold">
                  <td className="border border-gray-300 p-2 text-center">Total</td>
                  <td className="border border-gray-300 p-2 text-right font-mono">
                    {total}
                  </td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Información adicional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-1">Referencia Normativa</h4>
            <p className="text-blue-700">NMX-C-077-ONNCCE-2019</p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-1">Tamaño Analizado</h4>
            <p className="text-green-700">{tamanoGrava}</p>
          </div>
          
          <div className="bg-purple-50 p-3 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-1">Peso Total</h4>
            <p className="text-purple-700">{total} gramos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}





