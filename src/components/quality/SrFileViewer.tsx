import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { parseSr3File } from '@/utils/sr3Parser';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SrFileViewerProps {
  file: File;
}

export function SrFileViewer({ file }: SrFileViewerProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [maxForce, setMaxForce] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  useEffect(() => {
    if (!file) return;
    
    const processFile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Read file content
        const content = await readFileAsText(file);
        
        // Parse SR3 file with debug info - always enable debug mode
        const result = parseSr3File(content, true);
        
        // Store the chart data and max force
        setChartData(result.chartData);
        setMaxForce(result.maxForce);
        
        // Ensure debug info is always generated
        setDebugInfo(result.debug || {
          processingLog: ['No debug information available in production'],
          detectedFormat: result.metadata?.fileFormat || 'unknown',
          headerLines: result.metadata?.headerLines || 0
        });
        
        // Log debug info to console in production too
        console.log('SR3 Parser Result:', {
          maxForce: result.maxForce,
          dataPoints: result.timeData?.length || 0,
          format: result.metadata?.fileFormat,
          debug: result.debug
        });
        
      } catch (err) {
        console.error('Error processing SR3 file:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido al procesar el archivo');
      } finally {
        setLoading(false);
      }
    };
    
    processFile();
  }, [file]);
  
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('No se pudo leer el archivo'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
      
      reader.readAsText(file);
    });
  };
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Procesando archivo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Error al procesar archivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{error}</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)} type="button">
              {showDebug ? "Ocultar Detalles" : "Mostrar Detalles de Error"}
            </Button>
            
            {showDebug && debugInfo && (
              <div className="mt-4 text-xs font-mono bg-gray-100 p-4 rounded-md overflow-auto max-h-80">
                <p className="font-semibold mb-2">Debug Info:</p>
                <pre>{JSON.stringify(debugInfo.processingLog || debugInfo, null, 2)}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center">
            <BarChart className="h-5 w-5 mr-2 text-primary" />
            Datos de ensayo
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {maxForce !== null && `${maxForce.toFixed(2)} kg`}
          </Badge>
        </div>
        <CardDescription>
          {file.name} ({(file.size / 1024).toFixed(2)} KB)
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs defaultValue="debug">
          <TabsList>
            <TabsTrigger value="chart" type="button">Gráfica</TabsTrigger>
            <TabsTrigger value="debug" type="button">Detalles</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart">
            {chartData && chartData.datasets[0].data.length > 1 ? (
              <div className="h-64">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Fuerza (kg)'
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Tiempo (s)'
                        }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 h-64 border border-dashed rounded-md">
                <span className="text-gray-500 mb-4">No hay suficientes datos para la gráfica</span>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {maxForce !== null ? `Fuerza máxima: ${maxForce.toFixed(2)} kg` : 'Sin datos'}
                </Badge>
                <p className="text-sm text-gray-500 mt-4">
                  Para el cálculo de resistencia solo se requiere fuerza máxima, no es necesaria la gráfica
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="debug">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-medium">Fuerza máxima:</p>
                  <Badge variant="outline">{maxForce?.toFixed(2)} kg</Badge>
                </div>
                <div>
                  <p className="font-medium">Formato:</p>
                  <Badge variant="outline">{debugInfo?.detectedFormat || 'Desconocido'}</Badge>
                </div>
                <div>
                  <p className="font-medium">Puntos de datos:</p>
                  <Badge variant="outline">{chartData?.labels?.length || 0}</Badge>
                </div>
                <div>
                  <p className="font-medium">Líneas de cabecera:</p>
                  <Badge variant="outline">{debugInfo?.headerLines || 0}</Badge>
                </div>
              </div>
              
              <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)} className="mt-4" type="button">
                {showDebug ? "Ocultar Log" : "Mostrar Log de Procesamiento"}
              </Button>
              
              {showDebug && (
                <div className="mt-4">
                  <p className="font-medium mb-1">Log de procesamiento:</p>
                  <div className="text-xs font-mono bg-gray-100 p-4 rounded-md overflow-auto max-h-80">
                    {debugInfo?.processingLog ? (
                      debugInfo.processingLog.map((log: string, i: number) => (
                        <div key={i} className="mb-1">
                          {i+1}: {log}
                        </div>
                      ))
                    ) : (
                      <div className="mb-1">No hay logs de procesamiento disponibles</div>
                    )}
                    
                    {!debugInfo?.processingLog && debugInfo && (
                      <div className="mt-4">
                        <p className="font-semibold mb-1">Información de depuración:</p>
                        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="text-xs text-gray-500 pt-0">
        Versión de parser: 1.1 • Nota: Los datos y cálculos mostrados son aproximados
      </CardFooter>
    </Card>
  );
} 