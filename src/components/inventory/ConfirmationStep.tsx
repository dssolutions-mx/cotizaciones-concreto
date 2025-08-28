import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Check, FileImage, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { type Point } from './CornerAdjustment';

interface ConfirmationStepProps {
  originalImage: string;
  finalImage: string;
  corners: Point[];
  qualityMetrics?: any;
  onBack: () => void;
  onConfirm: (finalImage: string) => void;
  isProcessing?: boolean;
}

/**
 * Step 4: Final Confirmation
 * Review the processed document and confirm for saving
 */
export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  originalImage,
  finalImage,
  corners,
  qualityMetrics,
  onBack,
  onConfirm,
  isProcessing = false
}) => {
  const handleConfirm = () => {
    onConfirm(finalImage);
  };

  const handleDownload = () => {
    // Create a temporary link to download the image
    const link = document.createElement('a');
    link.download = `documento_procesado_${Date.now()}.jpg`;
    link.href = finalImage;
    link.click();
    toast.success('Imagen descargada exitosamente');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atrás
        </Button>
        <div className="text-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Check className="h-5 w-5" />
            Paso 4: Confirmación Final
          </h2>
          <p className="text-sm text-gray-600">
            Revisa tu documento procesado antes de guardarlo
          </p>
        </div>
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Descargar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Image Comparison */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Comparación Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-600">Imagen Original</h4>
                  <img
                    src={originalImage}
                    alt="Imagen original"
                    className="w-full h-auto max-h-64 object-contain border rounded"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2 text-blue-600">Documento Procesado</h4>
                  <img
                    src={finalImage}
                    alt="Documento procesado"
                    className="w-full h-auto max-h-64 object-contain border-2 border-blue-200 rounded"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side - Details and Confirmation */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles del Procesamiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Processing Summary */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Resumen del Procesamiento:</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">✓</Badge>
                    <span>Imagen capturada exitosamente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">✓</Badge>
                    <span>Esquinas del documento ajustadas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">✓</Badge>
                    <span>Documento extraído correctamente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">✓</Badge>
                    <span>Mejoras de imagen aplicadas</span>
                  </div>
                </div>
              </div>

              {/* Corner Information */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Esquinas Ajustadas:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {corners.map((corner, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'][index]
                        }}
                      />
                      <span>Esquina {index + 1}: ({Math.round(corner.x)}, {Math.round(corner.y)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Metrics */}
              {qualityMetrics && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Métricas de Calidad:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-blue-50 p-2 rounded">
                      <div className="font-medium">Brillo: {(qualityMetrics.brightness * 100).toFixed(0)}%</div>
                      <div className="font-medium">Contraste: {(qualityMetrics.contrast * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <div className="font-medium">Nitidez: {(qualityMetrics.sharpness * 100).toFixed(0)}%</div>
                      <div className="font-medium">
                        Calidad: {
                          qualityMetrics.overallQuality > 0.8 ? 'Excelente' :
                          qualityMetrics.overallQuality > 0.6 ? 'Buena' :
                          qualityMetrics.overallQuality > 0.4 ? 'Regular' : 'Deficiente'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Information */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Información del Archivo:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Formato: JPEG</div>
                  <div>Calidad: 95%</div>
                  <div>Procesamiento: Completo</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">¿Todo listo?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Tu documento ha sido procesado exitosamente. Haz clic en "Confirmar y Guardar"
                para agregarlo a tu lista de archivos.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={onBack}
                  variant="outline"
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Hacer Cambios
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar y Guardar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationStep;
