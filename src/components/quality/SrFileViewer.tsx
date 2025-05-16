import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { parseSr3File, extractMaxForce } from '@/utils/sr3Parser';
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
        
        // Define multiple encodings to try
        const encodings = ['UTF-8', 'ISO-8859-1', 'windows-1252'];
        let success = false;
        let result;
        let processingLog: string[] = [];
        
        processingLog.push(`Processing file: ${file.name} (${file.size} bytes)`);
        
        // Try parsing with different encodings
        for (const encoding of encodings) {
          if (success) break;
          
          try {
            processingLog.push(`Trying encoding: ${encoding}`);
            
            // Read file with specific encoding
            const content = await readFileWithEncoding(file, encoding);
            
            // Check if content might be binary
            const hasBinaryContent = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.substring(0, 1000));
            processingLog.push(`File appears to be binary: ${hasBinaryContent}`);
            
            // First try to extract just the max force (more robust)
            const maxForceValue = extractMaxForce(content);
            if (maxForceValue > 0) {
              processingLog.push(`Successfully extracted max force: ${maxForceValue} kg with encoding: ${encoding}`);
              
              // Try full parsing
              result = parseSr3File(content, true);
              
              // If we have data points, great! Use those for visualization
              if (result && result.timeData && result.timeData.length > 1) {
                processingLog.push(`Successfully parsed ${result.timeData.length} data points`);
                success = true;
                break;
              } else {
                // We have a max force but no data points, create synthetic data for visualization
                processingLog.push(`Got max force but no data points, will create synthetic data`);
                result = {
                  maxForce: maxForceValue,
                  timeData: [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
                  forceData: [
                    0,
                    maxForceValue * 0.25,
                    maxForceValue * 0.5,
                    maxForceValue * 0.85,
                    maxForceValue,
                    maxForceValue * 0.85,
                    maxForceValue * 0.5,
                    maxForceValue * 0.25,
                    0
                  ],
                  chartData: {
                    labels: [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
                    datasets: [
                      {
                        label: 'Fuerza (kg) - Estimado',
                        data: [
                          0,
                          maxForceValue * 0.25,
                          maxForceValue * 0.5,
                          maxForceValue * 0.85,
                          maxForceValue,
                          maxForceValue * 0.85,
                          maxForceValue * 0.5,
                          maxForceValue * 0.25,
                          0
                        ],
                        borderColor: 'rgb(53, 162, 235)',
                        backgroundColor: 'rgba(53, 162, 235, 0.5)',
                      },
                    ],
                  },
                  metadata: {
                    fileFormat: 'synthetic',
                    separator: ';',
                    totalPoints: 9,
                    headerLines: 0
                  },
                  debug: {
                    processingLog: [...processingLog, 'Created synthetic data for visualization'],
                    detectedFormat: 'max_force_only',
                    isBinary: hasBinaryContent,
                    headerLines: 0
                  }
                };
                success = true;
                break;
              }
            }
          } catch (err) {
            processingLog.push(`Error with encoding ${encoding}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        
        // If we still don't have success, make one last attempt just to get the max force
        if (!success) {
          processingLog.push('All encoding attempts failed, trying one last approach');
          
          try {
            // Try with Latin1 (ISO-8859-1) which is most permissive with binary data
            const content = await readFileWithEncoding(file, 'ISO-8859-1');
            const maxForceValue = extractMaxForce(content);
            
            if (maxForceValue > 0) {
              processingLog.push(`Last resort: found max force: ${maxForceValue} kg`);
              
              // Create synthetic data
              result = {
                maxForce: maxForceValue,
                timeData: [0, 1, 2, 3, 4],
                forceData: [0, maxForceValue*0.5, maxForceValue, maxForceValue*0.5, 0],
                chartData: {
                  labels: [0, 1, 2, 3, 4],
                  datasets: [{
                    label: 'Fuerza (kg) - Estimado',
                    data: [0, maxForceValue*0.5, maxForceValue, maxForceValue*0.5, 0],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                  }]
                },
                metadata: {
                  fileFormat: 'synthetic',
                  separator: '',
                  totalPoints: 5,
                  headerLines: 0
                },
                debug: {
                  processingLog,
                  detectedFormat: 'fallback',
                  headerLines: 0
                }
              };
              success = true;
            } else {
              throw new Error('No se pudo extraer la fuerza máxima del archivo');
            }
          } catch (err) {
            processingLog.push(`Final attempt failed: ${err instanceof Error ? err.message : String(err)}`);
            throw err;
          }
        }
        
        if (success && result) {
          // Store the chart data and max force
          setChartData(result.chartData);
          setMaxForce(result.maxForce);
          
          // Ensure debug info is always available
          setDebugInfo(result.debug || {
            processingLog,
            detectedFormat: result.metadata?.fileFormat || 'unknown',
            headerLines: result.metadata?.headerLines || 0
          });
          
          // Log result to console for debugging
          console.log('SR3 Parser Result:', {
            maxForce: result.maxForce,
            dataPoints: result.timeData?.length || 0,
            format: result.metadata?.fileFormat,
            synthetic: !result.timeData || result.timeData.length <= 1,
            debug: result.debug || { processingLog }
          });
        } else {
          throw new Error('No se pudo procesar el archivo SR3');
        }
      } catch (err) {
        console.error('Error processing SR3 file:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido al procesar el archivo');
        setDebugInfo({ processingLog: [`Error: ${err instanceof Error ? err.message : String(err)}`] });
      } finally {
        setLoading(false);
      }
    };
    
    processFile();
  }, [file]);
  
  // Read file with specific encoding
  const readFileWithEncoding = (file: File, encoding: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error(`No se pudo leer el archivo con codificación ${encoding}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error(`Error al leer el archivo con codificación ${encoding}`));
      };
      
      reader.readAsText(file, encoding);
    });
  };
  
  // Original readFileAsText is still used as a fallback
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