import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Line } from 'react-chartjs-2';
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
import { parseSr3File } from '@/utils/sr3Parser';

// Register Chart.js components
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
  file: File | null;
}

export function SrFileViewer({ file }: SrFileViewerProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [maxForce, setMaxForce] = useState<number | null>(null);

  // Process the SR3 file when it changes
  useEffect(() => {
    if (!file) return;
    
    processSrFile(file);
  }, [file]);

  const processSrFile = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      
      // Read the file as a text
      const fileContent = await readFileAsText(file);
      
      // Use our SR3 parser utility
      const parsedData = parseSr3File(fileContent);
      
      setChartData(parsedData.chartData);
      setMaxForce(parsedData.maxForce);
    } catch (err) {
      console.error('Error processing SR3 file:', err);
      setError('No se pudo procesar el archivo. El formato podría no ser compatible.');
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-gray-500">Procesando archivo...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!file || !chartData) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center p-4 text-gray-400">
            <FileSpreadsheet className="h-12 w-12 mb-2" />
            <p>No hay archivo seleccionado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Resultados del ensayo: {file.name}
        </CardTitle>
        {maxForce && (
          <div className="mt-1 text-sm">
            <span className="font-medium">Carga máxima:</span>{' '}
            <span className="font-bold text-primary">{maxForce.toFixed(2)} kg</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Tiempo (s)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Fuerza (kg)'
                  },
                  beginAtZero: true
                }
              },
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  enabled: true
                }
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
} 