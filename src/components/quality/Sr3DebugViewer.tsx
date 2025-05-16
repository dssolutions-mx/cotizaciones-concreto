import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseSr3File } from '@/utils/sr3Parser';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Download, ChevronDown, ChevronRight, Code, Layers } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Sr3DebugViewerProps {
  file: File | null;
}

export function Sr3DebugViewer({ file }: Sr3DebugViewerProps) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Read and analyze file
  const analyzeFile = async () => {
    if (!file) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Read file content
      const content = await readFileAsText(file);
      setFileContent(content);
      
      // Parse with debug information
      const result = parseSr3File(content, true);
      setParsedData(result);
    } catch (err) {
      console.error('Error analyzing SR3 file:', err);
      setError('Error al analizar el archivo');
    } finally {
      setLoading(false);
    }
  };
  
  // Read file as text
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
  
  // Download parsed data as JSON
  const downloadParsedData = () => {
    if (!parsedData) return;
    
    const dataStr = JSON.stringify(parsedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${file?.name || 'sr3'}_debug.json`);
    a.click();
    
    URL.revokeObjectURL(url);
  };
  
  if (!file) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No hay archivo seleccionado para analizar
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!parsedData && !loading) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-4">Archivo sin analizar</h3>
          <Button onClick={analyzeFile} type="button">
            Analizar Estructura del Archivo
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
            <span className="ml-3">Analizando archivo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center text-yellow-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const debug = parsedData?.debug || {};
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Análisis de Archivo {file.name}</CardTitle>
            <CardDescription>Información de depuración para entender la estructura del archivo</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadParsedData} type="button">
            <Download className="h-4 w-4 mr-2" />
            Descargar Datos JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="mb-4">
            <TabsTrigger value="summary" type="button">Resumen</TabsTrigger>
            <TabsTrigger value="raw" type="button">Datos Crudos</TabsTrigger>
            <TabsTrigger value="parsing" type="button">Proceso de Parsing</TabsTrigger>
            <TabsTrigger value="headers" type="button">Cabeceras Detectadas</TabsTrigger>
          </TabsList>
          
          {/* Summary Tab */}
          <TabsContent value="summary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información del Archivo</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nombre:</span>
                      <span className="font-medium">{file.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tamaño:</span>
                      <span className="font-medium">{(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="font-medium">{file.type || 'application/octet-stream'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo detectado:</span>
                      <Badge variant={debug.isBinary ? "destructive" : "default"}>
                        {debug.isBinary ? 'Binario' : 'Texto'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Formato detectado:</span>
                      <Badge variant="outline">
                        {debug.detectedFormat === 'text_with_header' 
                          ? 'Texto con Cabecera' 
                          : debug.detectedFormat === 'text_data_only' 
                            ? 'Solo Datos' 
                            : debug.detectedFormat}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estadísticas de Parsing</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Líneas totales:</span>
                      <span className="font-medium">{debug.totalLines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Líneas de cabecera:</span>
                      <span className="font-medium">{debug.headerLines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Líneas de datos:</span>
                      <span className="font-medium">{debug.dataLines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Puntos de datos válidos:</span>
                      <span className="font-medium">{debug.validDataPoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fuerza máxima:</span>
                      <span className="font-medium text-primary">{parsedData.maxForce.toFixed(2)} kg</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {debug.parsingErrors && debug.parsingErrors.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Errores y Advertencias</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-40">
                    <div className="space-y-2">
                      {debug.parsingErrors.map((error: string, i: number) => (
                        <div key={i} className="text-yellow-600 text-sm flex items-start">
                          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Raw Data Tab */}
          <TabsContent value="raw">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contenido del Archivo</CardTitle>
                <CardDescription>Primeras 20 líneas del archivo</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-80 border rounded-md bg-gray-50 p-2">
                  <pre className="font-mono text-xs whitespace-pre-wrap">
                    {debug.firstFewLines?.map((line: string, i: number) => (
                      <div key={i} className={i < debug.headerLines ? "text-blue-600" : ""}>
                        {i+1}: {line || "<línea vacía>"}
                      </div>
                    ))}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Parsing Process Tab */}
          <TabsContent value="parsing">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Muestras de Datos Detectadas</CardTitle>
                <CardDescription>
                  Ejemplos de líneas que se pudieron procesar como datos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-80">
                  <div className="space-y-4">
                    {debug.possibleDataSamples?.map((sample: any, i: number) => (
                      <Collapsible key={i} className="border rounded-md p-2">
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left" type="button">
                          <div className="flex items-center">
                            <ChevronRight className="h-4 w-4 mr-2 text-gray-500 collapsible-icon" />
                            <code className="text-xs font-mono bg-gray-100 p-1 rounded">{sample.line}</code>
                          </div>
                          {sample.parsed?.valid && (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              Válido
                            </Badge>
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 pl-6">
                          <div className="text-xs">
                            <div><span className="font-medium">Separador:</span> {sample.parsed?.separator}</div>
                            <div className="mt-1">
                              <span className="font-medium">Valores:</span>{' '}
                              {sample.parsed?.values?.map((v: number, i: number) => (
                                <span key={i} className="inline-block mr-2 bg-gray-100 px-1 rounded">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Headers Tab */}
          <TabsContent value="headers">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalles de Detección de Cabeceras</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {debug.parsingErrors
                      ?.filter((err: string) => err.startsWith('Header detection:'))
                      .map((note: string, i: number) => (
                        <div key={i} className="text-sm">
                          <code className="text-xs bg-gray-100 p-1 rounded">
                            {note.replace('Header detection: ', '')}
                          </code>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 