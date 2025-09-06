import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, ArrowRight, Download, Sparkles, Contrast, Sun, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { type Point } from './CornerAdjustment';

interface ImageEnhancementStepProps {
  originalImage: string;
  extractedImage: string;
  corners: Point[];
  qualityMetrics?: any;
  onBack: () => void;
  onNext: (finalImage: string, enhancedMetrics?: any) => void;
  isProcessing?: boolean;
}

/**
 * Step 3: Image Enhancement & Processing
 * Handles final image processing, enhancement, and quality optimization
 */
export const ImageEnhancementStep: React.FC<ImageEnhancementStepProps> = ({
  originalImage,
  extractedImage,
  corners,
  qualityMetrics,
  onBack,
  onNext,
  isProcessing = false
}) => {
  const [enhancedImage, setEnhancedImage] = useState<string>(extractedImage);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [sharpness, setSharpness] = useState<number>(0);
  const [enhancementEnabled, setEnhancementEnabled] = useState<boolean>(false);
  const [enhancedMetrics, setEnhancedMetrics] = useState<any>(qualityMetrics);

  // Apply image enhancements
  const applyEnhancements = useCallback(async () => {
    if (!enhancementEnabled) {
      setEnhancedImage(extractedImage);
      setEnhancedMetrics(qualityMetrics);
      return;
    }

    try {
      // Import scanner dynamically to avoid circular dependencies
      const { scannerManager } = await import('./scanner');

      // Create canvas from the extracted image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        throw new Error('Could not create canvas context');
      }

      const img = new Image();
      img.onload = async () => {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);

        let processedCanvas = tempCanvas;

        // Apply brightness adjustment
        if (brightness !== 0) {
          processedCanvas = await applyBrightnessAdjustment(processedCanvas, brightness);
        }

        // Apply contrast adjustment
        if (contrast !== 0) {
          processedCanvas = await applyContrastAdjustment(processedCanvas, contrast);
        }

        // Apply sharpness adjustment
        if (sharpness !== 0) {
          processedCanvas = await applySharpnessAdjustment(processedCanvas, sharpness);
        }

        // Apply automatic enhancement
        if (enhancementEnabled) {
          processedCanvas = await applyAutoEnhancement(processedCanvas);
        }

        // Convert to data URL
        const finalImage = processedCanvas.toDataURL('image/jpeg', 0.95);
        setEnhancedImage(finalImage);

        // Calculate enhanced quality metrics
        try {
          const advancedProcessor = (scannerManager as any).advancedProcessor;
          if (advancedProcessor && typeof advancedProcessor.analyzeDocumentQuality === 'function') {
            const metrics = await advancedProcessor.analyzeDocumentQuality(processedCanvas);
            setEnhancedMetrics(metrics);
          }
        } catch (qualityError) {
          console.warn('Enhanced quality analysis failed:', qualityError);
        }

        toast.success('Mejoras aplicadas exitosamente');
      };
      img.src = extractedImage;
    } catch (error) {
      console.error('Enhancement failed:', error);
      toast.error('Error al aplicar mejoras');
    }
  }, [extractedImage, qualityMetrics, brightness, contrast, sharpness, enhancementEnabled]);

  // Brightness adjustment
  const applyBrightnessAdjustment = useCallback(async (canvas: HTMLCanvasElement, value: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(canvas);
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const adjustment = value * 2.55; // Convert percentage to 0-255 range

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + adjustment));     // Red
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // Green
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // Blue
        // Alpha channel remains unchanged
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    });
  }, []);

  // Contrast adjustment
  const applyContrastAdjustment = useCallback(async (canvas: HTMLCanvasElement, value: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(canvas);
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const factor = (value + 100) / 100; // Convert percentage to factor

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, ((data[i] - 128) * factor) + 128));     // Red
        data[i + 1] = Math.max(0, Math.min(255, ((data[i + 1] - 128) * factor) + 128)); // Green
        data[i + 2] = Math.max(0, Math.min(255, ((data[i + 2] - 128) * factor) + 128)); // Blue
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    });
  }, []);

  // Sharpness adjustment
  const applySharpnessAdjustment = useCallback(async (canvas: HTMLCanvasElement, value: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(canvas);
        return;
      }

      // Simple unsharp mask implementation
      const strength = value / 100;
      const radius = 1;

      // Create a temporary canvas for the blurred version
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;

      if (!tempCtx) {
        resolve(canvas);
        return;
      }

      // Copy original image
      tempCtx.drawImage(canvas, 0, 0);

      // Apply blur
      tempCtx.filter = `blur(${radius}px)`;
      tempCtx.drawImage(tempCanvas, 0, 0);

      // Get both original and blurred image data
      const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const blurredData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

      const originalPixels = originalData.data;
      const blurredPixels = blurredData.data;

      // Apply unsharp mask
      for (let i = 0; i < originalPixels.length; i += 4) {
        originalPixels[i] = Math.max(0, Math.min(255,
          originalPixels[i] + strength * (originalPixels[i] - blurredPixels[i])));
        originalPixels[i + 1] = Math.max(0, Math.min(255,
          originalPixels[i + 1] + strength * (originalPixels[i + 1] - blurredPixels[i + 1])));
        originalPixels[i + 2] = Math.max(0, Math.min(255,
          originalPixels[i + 2] + strength * (originalPixels[i + 2] - blurredPixels[i + 2])));
      }

      ctx.putImageData(originalData, 0, 0);
      resolve(canvas);
    });
  }, []);

  // Auto enhancement - with fallback to simple scanner
  const applyAutoEnhancement = useCallback(async (canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> => {
    try {
      const { scannerManager, simpleScanner } = await import('./scanner');

      // Try advanced processing first
      try {
        const enhancedCanvas = scannerManager.processBasic(canvas);
        if (enhancedCanvas) {
          return enhancedCanvas;
        }
      } catch (advancedError) {
        console.warn('Advanced enhancement failed, trying simple scanner:', advancedError);
      }

      // Fallback to simple scanner highlight (which applies basic enhancement)
      try {
        const img = new Image();
        img.src = canvas.toDataURL();

        return new Promise((resolve) => {
          img.onload = () => {
            const highlighted = simpleScanner.highlightDocument(img);
            resolve(highlighted || canvas);
          };
        });
      } catch (simpleError) {
        console.warn('Simple scanner enhancement also failed:', simpleError);
        return canvas;
      }
    } catch (error) {
      console.warn('Auto enhancement failed:', error);
      return canvas;
    }
  }, []);

  // Reset to original
  const resetToOriginal = useCallback(() => {
    setBrightness(0);
    setContrast(0);
    setSharpness(0);
    setEnhancementEnabled(false);
    setEnhancedImage(extractedImage);
    setEnhancedMetrics(qualityMetrics);
  }, [extractedImage, qualityMetrics]);

  // Handle next step
  const handleNext = useCallback(() => {
    onNext(enhancedImage, enhancedMetrics);
  }, [enhancedImage, enhancedMetrics, onNext]);

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
            <Sparkles className="h-5 w-5" />
            Paso 3: Mejora de Imagen
          </h2>
          <p className="text-sm text-gray-600">
            Optimiza la calidad y apariencia del documento
          </p>
        </div>
        <Button onClick={resetToOriginal} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Restaurar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Image Comparison */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Antes y Después</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Original</h4>
                  <img
                    src={extractedImage}
                    alt="Documento original"
                    className="w-full h-auto max-h-48 object-contain border rounded"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Mejorado</h4>
                  <img
                    src={enhancedImage}
                    alt="Documento mejorado"
                    className="w-full h-auto max-h-48 object-contain border rounded"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quality Comparison */}
          {enhancedMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Métricas de Calidad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-600">Original</h4>
                    {qualityMetrics && (
                      <div className="space-y-1">
                        <div>Brillo: {(qualityMetrics.brightness * 100).toFixed(0)}%</div>
                        <div>Contraste: {(qualityMetrics.contrast * 100).toFixed(0)}%</div>
                        <div>Nitidez: {(qualityMetrics.sharpness * 100).toFixed(0)}%</div>
                        <div>
                          Calidad: {
                            qualityMetrics.overallQuality > 0.8 ? 'Excelente' :
                            qualityMetrics.overallQuality > 0.6 ? 'Buena' :
                            qualityMetrics.overallQuality > 0.4 ? 'Regular' : 'Deficiente'
                          }
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-600">Mejorado</h4>
                    <div className="space-y-1">
                      <div>Brillo: {(enhancedMetrics.brightness * 100).toFixed(0)}%</div>
                      <div>Contraste: {(enhancedMetrics.contrast * 100).toFixed(0)}%</div>
                      <div>Nitidez: {(enhancedMetrics.sharpness * 100).toFixed(0)}%</div>
                      <div>
                        Calidad: {
                          enhancedMetrics.overallQuality > 0.8 ? 'Excelente' :
                          enhancedMetrics.overallQuality > 0.6 ? 'Buena' :
                          enhancedMetrics.overallQuality > 0.4 ? 'Regular' : 'Deficiente'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right side - Enhancement Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controles de Mejora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Enhancement Toggle */}
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={enhancementEnabled}
                    onChange={(e) => setEnhancementEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="font-medium">Mejora Automática</span>
                </label>
                <Badge variant="secondary">
                  <Zap className="h-3 w-3 mr-1" />
                  Recomendado
                </Badge>
              </div>

              {/* Brightness Control */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium">
                  <Sun className="h-4 w-4 mr-2" />
                  Brillo: {brightness}%
                </label>
                <Slider
                  value={[brightness]}
                  onValueChange={(value) => setBrightness(value[0])}
                  min={-50}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Contrast Control */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium">
                  <Contrast className="h-4 w-4 mr-2" />
                  Contraste: {contrast}%
                </label>
                <Slider
                  value={[contrast]}
                  onValueChange={(value) => setContrast(value[0])}
                  min={-50}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Sharpness Control */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Nitidez: {sharpness}%
                </label>
                <Slider
                  value={[sharpness]}
                  onValueChange={(value) => setSharpness(value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Apply Button */}
              <Button
                onClick={applyEnhancements}
                className="w-full"
                disabled={isProcessing}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Aplicar Mejoras
              </Button>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atrás
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEnhancementStep;
