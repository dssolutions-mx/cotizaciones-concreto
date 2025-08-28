import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Move, ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import CornerAdjustment, { type Point } from './CornerAdjustment';

interface EdgeDetectionStepProps {
  imageSrc: string;
  initialCorners?: Point[];
  processedCanvas?: HTMLCanvasElement | null;
  onBack: () => void;
  onNext: (corners: Point[], extractedImage: string, qualityMetrics?: any) => void;
  onRetry: () => void;
  isProcessing?: boolean;
}

/**
 * Step 2: Edge Detection & Corner Adjustment
 * Handles edge detection and allows manual corner adjustment
 */
export const EdgeDetectionStep: React.FC<EdgeDetectionStepProps> = ({
  imageSrc,
  initialCorners,
  processedCanvas: propProcessedCanvas,
  onBack,
  onNext,
  onRetry,
  isProcessing = false
}) => {
  const [detectedCorners, setDetectedCorners] = useState<Point[]>(initialCorners || []);
  const [adjustedCorners, setAdjustedCorners] = useState<Point[]>(initialCorners || []);
  const [previewCorners, setPreviewCorners] = useState<Point[]>([]); // Corners scaled for preview
  const [cornersConfirmed, setCornersConfirmed] = useState(false); // Always allow corner adjustment
  const [extractedImage, setExtractedImage] = useState<string | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(propProcessedCanvas || null);
  const [isDetectingCorners, setIsDetectingCorners] = useState(false);
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{width: number, height: number} | null>(null);

  // Update processedCanvas when prop changes
  useEffect(() => {
    if (propProcessedCanvas) {
      setProcessedCanvas(propProcessedCanvas);
    }
  }, [propProcessedCanvas]);

  // Load original image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setOriginalImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      console.log('📐 Original image dimensions loaded:', img.naturalWidth, 'x', img.naturalHeight);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Scale corners for preview display
  const scaleCornersForPreview = useCallback((corners: Point[], sourceCanvas?: HTMLCanvasElement | null): Point[] => {
    if (!corners.length || !originalImageDimensions) return corners;

    const previewWidth = 600;  // CornerAdjustment canvas width
    const previewHeight = 400; // CornerAdjustment canvas height

    // Use the original image dimensions for scaling calculations
    const sourceWidth = originalImageDimensions.width;
    const sourceHeight = originalImageDimensions.height;

    // Calculate scaling factors to fit the source into the preview while maintaining aspect ratio
    const scaleX = previewWidth / sourceWidth;
    const scaleY = previewHeight / sourceHeight;
    const scale = Math.min(scaleX, scaleY); // Use the smaller scale to fit entirely

    // Calculate offset to center the scaled image
    const scaledWidth = sourceWidth * scale;
    const scaledHeight = sourceHeight * scale;
    const offsetX = (previewWidth - scaledWidth) / 2;
    const offsetY = (previewHeight - scaledHeight) / 2;

    console.log('📐 Scaling corners for preview:', {
      sourceSize: `${sourceWidth}x${sourceHeight}`,
      previewSize: `${previewWidth}x${previewHeight}`,
      scale: scale.toFixed(4),
      offset: `${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`,
      originalCorners: corners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`)
    });

    return corners.map(corner => ({
      x: Math.max(0, Math.min(previewWidth, corner.x * scale + offsetX)),
      y: Math.max(0, Math.min(previewHeight, corner.y * scale + offsetY))
    }));
  }, [originalImageDimensions]);

  // Convert corners back from preview coordinates to original coordinate system
  const convertPreviewCornersToOriginal = useCallback((previewCorners: Point[]): Point[] => {
    if (!previewCorners.length || !originalImageDimensions) {
      console.warn('⚠️ Cannot convert preview corners: missing data', {
        hasCorners: previewCorners.length > 0,
        hasImageDimensions: !!originalImageDimensions
      });
      return previewCorners;
    }

    const previewWidth = 600;
    const previewHeight = 400;

    // Use stored image dimensions for conversion
    const sourceWidth = originalImageDimensions.width;
    const sourceHeight = originalImageDimensions.height;

    // Calculate the same scaling factors used for preview
    const scaleX = previewWidth / sourceWidth;
    const scaleY = previewHeight / sourceHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate the same offset used for preview
    const scaledWidth = sourceWidth * scale;
    const scaledHeight = sourceHeight * scale;
    const offsetX = (previewWidth - scaledWidth) / 2;
    const offsetY = (previewHeight - scaledHeight) / 2;

    const convertedCorners = previewCorners.map(corner => ({
      x: Math.max(0, Math.min(sourceWidth, (corner.x - offsetX) / scale)),
      y: Math.max(0, Math.min(sourceHeight, (corner.y - offsetY) / scale))
    }));

    console.log('📐 Converting preview corners to original:', {
      sourceSize: `${sourceWidth}x${sourceHeight}`,
      previewSize: `${previewWidth}x${previewHeight}`,
      scale: scale.toFixed(4),
      offset: `${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`,
      previewCorners: previewCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`),
      convertedCorners: convertedCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`)
    });

    return convertedCorners;
  }, [originalImageDimensions]);

  // Update preview corners when detected corners or original image dimensions change
  useEffect(() => {
    if (detectedCorners.length > 0 && originalImageDimensions) {
      const scaledCorners = scaleCornersForPreview(detectedCorners);
      setPreviewCorners(scaledCorners);
      setAdjustedCorners(scaledCorners); // Also update adjusted corners for consistency
      console.log('📐 Scaled corners for preview:', {
        originalCorners: detectedCorners,
        scaledCorners: scaledCorners,
        originalImageSize: `${originalImageDimensions.width}x${originalImageDimensions.height}`,
        previewSize: '600x400'
      });
    }
  }, [detectedCorners, originalImageDimensions, scaleCornersForPreview]);

  // Handle auto-detection - with fallback to simple scanner
  const handleAutoDetect = useCallback(async () => {
    if (isDetectingCorners) return; // Prevent multiple simultaneous detections
    if (detectedCorners.length > 0) {
      toast.info('Esquinas ya detectadas - puede ajustarlas manualmente si es necesario');
      return; // Don't run detection if we already have corners
    }

    setIsDetectingCorners(true);
    try {
      // Import scanners dynamically to avoid circular dependencies
      const { scannerManager, simpleScanner } = await import('./scanner');

      // Create a temporary canvas with the image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const img = new Image();
      img.onload = async () => {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);

        // Try advanced scanner first (includes simple scanner)
        try {
          const result = await scannerManager.detectDocumentAdvanced(tempCanvas, false);

          if (result.success && result.corners) {
            // Store the processed canvas for later extraction
            const detectedProcessedCanvas = (result as any).processedCanvas || tempCanvas;
            setProcessedCanvas(detectedProcessedCanvas);
            
            // If we have a processed canvas (from simple scanner), we need to convert corners
            // from processed canvas coordinate system to original image coordinate system
            let convertedCorners = result.corners;
            
            if (detectedProcessedCanvas && detectedProcessedCanvas !== tempCanvas && originalImageDimensions) {
              // Convert from processed canvas coordinates to original image coordinates
              const scaleX = originalImageDimensions.width / detectedProcessedCanvas.width;
              const scaleY = originalImageDimensions.height / detectedProcessedCanvas.height;
              
              convertedCorners = result.corners.map(corner => ({
                x: corner.x * scaleX,
                y: corner.y * scaleY
              }));
              
              console.log('📐 Converting detected corners from processed to original:', {
                processedCanvasSize: `${detectedProcessedCanvas.width}x${detectedProcessedCanvas.height}`,
                originalImageSize: `${originalImageDimensions.width}x${originalImageDimensions.height}`,
                scale: `${scaleX.toFixed(4)}, ${scaleY.toFixed(4)}`,
                originalCorners: result.corners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`),
                convertedCorners: convertedCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`)
              });
            }
            
            setDetectedCorners(convertedCorners);
            setAdjustedCorners(convertedCorners);
            // Don't set cornersConfirmed to true - let user review/adjust first
            toast.success(`Esquinas detectadas automáticamente (${result.method || 'avanzado'}) - puede ajustarlas si es necesario`);
            return;
          }
        } catch (advancedError) {
          console.warn('Advanced detection failed:', advancedError);
        }

        toast.error('No se pudieron detectar esquinas automáticamente');
      };
      img.src = imageSrc;
    } catch (error) {
      console.error('Failed to import scanners:', error);
      toast.error('Error al cargar detectores automáticos');
    } finally {
      setIsDetectingCorners(false);
    }
  }, [imageSrc, isDetectingCorners, detectedCorners.length, originalImageDimensions]);

  // Handle corner confirmation - with fallback to simple scanner
  const handleCornerConfirmation = useCallback(async (corners: Point[]) => {
    setCornersConfirmed(true);
    setAdjustedCorners(corners);

    try {
      // Import scanners dynamically to avoid circular dependencies
      const { scannerManager, simpleScanner } = await import('./scanner');

      // Create canvas from the current image
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

        // Corners should be in the original coordinate system (already converted from preview)
        const scaledCorners = corners;
        console.log('📐 Using corners in original coordinate system:', {
          originalImageSize: `${img.width}x${img.height}`,
          corners: scaledCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`)
        });

        let extractedCanvas = null;

        // Extract from original canvas using corners in original coordinate system
        const canvasForExtraction = tempCanvas;
        // Don't pass processedCanvas as the corners are already in original coordinate system
        const processedCanvasForExtraction = undefined; 
        console.log(`📐 Extracting from original canvas: ${canvasForExtraction.width}x${canvasForExtraction.height}`);

        try {
          // Validate corners before extraction
          const validCorners = scaledCorners.filter(corner =>
            corner.x >= 0 && corner.x <= img.width &&
            corner.y >= 0 && corner.y <= img.height &&
            !isNaN(corner.x) && !isNaN(corner.y)
          );

          if (validCorners.length !== 4) {
            console.error('❌ Invalid corners detected:', {
              originalCorners: scaledCorners,
              validCorners: validCorners,
              imageSize: `${img.width}x${img.height}`
            });
            toast.error('Las coordenadas de las esquinas no son válidas');
            return;
          }

          console.log('✅ Extracting document with validated corners:', {
            corners: validCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`),
            imageSize: `${img.width}x${img.height}`,
            canvasForExtractionSize: `${canvasForExtraction.width}x${canvasForExtraction.height}`,
            processedCanvasForExtraction: processedCanvasForExtraction ? `${processedCanvasForExtraction.width}x${processedCanvasForExtraction.height}` : 'none'
          });

          extractedCanvas = await scannerManager.extractDocument(canvasForExtraction, validCorners, processedCanvasForExtraction);
        } catch (extractionError) {
          console.error('Document extraction failed:', extractionError);
          toast.error('Error al extraer el documento - revise las coordenadas de las esquinas');
        }

        if (extractedCanvas && extractedCanvas.width > 0 && extractedCanvas.height > 0) {
          const finalImage = extractedCanvas.toDataURL('image/jpeg', 0.95);
          setExtractedImage(finalImage);

          // Calculate quality metrics
          try {
            const advancedProcessor = (scannerManager as any).advancedProcessor;
            if (advancedProcessor && typeof advancedProcessor.analyzeDocumentQuality === 'function') {
              const metrics = await advancedProcessor.analyzeDocumentQuality(extractedCanvas);
              setQualityMetrics(metrics);
            }
          } catch (qualityError) {
            console.warn('Quality analysis failed:', qualityError);
            // Set default quality metrics
            setQualityMetrics({
              brightness: 0.5,
              contrast: 0.5,
              sharpness: 0.5,
              overallQuality: 0.5
            });
          }

          toast.success('Documento extraído exitosamente');
        } else {
          console.warn('Extracted canvas is invalid, creating fallback');
          // Create a fallback canvas with the original image
          const fallbackCanvas = document.createElement('canvas');
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx) {
            fallbackCanvas.width = tempCanvas.width;
            fallbackCanvas.height = tempCanvas.height;
            fallbackCtx.drawImage(tempCanvas, 0, 0);

            const fallbackImage = fallbackCanvas.toDataURL('image/jpeg', 0.95);
            setExtractedImage(fallbackImage);

            // Set default quality metrics for fallback
            setQualityMetrics({
              brightness: 0.5,
              contrast: 0.5,
              sharpness: 0.5,
              overallQuality: 0.5
            });

            toast.warning('Documento extraído con limitaciones - se usó imagen original');
          } else {
            toast.error('Error al extraer documento');
          }
        }
      };
      img.src = imageSrc;
    } catch (error) {
      console.error('Corner adjustment processing failed:', error);
      toast.error('Error al procesar documento');
    }
  }, [imageSrc]);

  // Handle corner adjustment cancellation
  const handleCornerCancellation = useCallback(() => {
    setCornersConfirmed(false);
    setAdjustedCorners([]);
    setExtractedImage(null);
    setQualityMetrics(null);
  }, []);

  // Handle proceeding to next step
  const handleNext = useCallback(() => {
    if (adjustedCorners.length === 4 && extractedImage) {
      onNext(adjustedCorners, extractedImage, qualityMetrics);
    } else {
      toast.error('Por favor confirme las esquinas primero');
    }
  }, [adjustedCorners, extractedImage, qualityMetrics, onNext]);

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
            <Move className="h-5 w-5" />
            Paso 2: Ajuste de Esquinas
          </h2>
          <p className="text-sm text-gray-600">
            Ajusta las esquinas del documento para una extracción perfecta
          </p>
        </div>
        <Button onClick={onRetry} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Corner Adjustment */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imagen Original</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <img
                  src={imageSrc}
                  alt="Imagen original"
                  className="w-full h-auto max-h-96 object-contain border rounded"
                />
                {detectedCorners.length > 0 && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Detectado
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Extracted preview */}
          {extractedImage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vista Previa Extraída</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={extractedImage}
                  alt="Documento extraído"
                  className="w-full h-auto max-h-64 object-contain border rounded"
                />
                {qualityMetrics && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
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
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right side - Corner Adjustment Interface */}
        <div>
          {!cornersConfirmed ? (
            detectedCorners.length > 0 ? (
              <CornerAdjustment
                imageSrc={imageSrc}
                initialCorners={previewCorners}
                onCornersAdjusted={(corners) => {
                  // Convert preview corners back to original coordinate system
                  const originalCorners = convertPreviewCornersToOriginal(corners);
                  setAdjustedCorners(originalCorners);
                  console.log('📐 Preview corners adjusted:', {
                    previewCorners: corners,
                    originalCorners: originalCorners
                  });
                }}
                onCancel={handleCornerCancellation}
                onConfirm={(corners) => {
                  // Convert preview corners back to original coordinate system before confirmation
                  const originalCorners = convertPreviewCornersToOriginal(corners);
                  handleCornerConfirmation(originalCorners);
                  console.log('📐 Preview corners confirmed:', {
                    previewCorners: corners,
                    originalCorners: originalCorners
                  });
                }}
                width={600}
                height={400}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Move className="h-5 w-5 text-orange-600" />
                    Ajuste Manual de Esquinas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    No se pudieron detectar esquinas automáticamente. Puede ajustar manualmente las esquinas del documento.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => {
                        // Set default corners for manual adjustment
                        const defaultCorners: Point[] = [
                          { x: 50, y: 50 },
                          { x: 550, y: 50 },
                          { x: 550, y: 350 },
                          { x: 50, y: 350 }
                        ];
                        setDetectedCorners(defaultCorners);
                        setAdjustedCorners(defaultCorners);
                        toast.info('Esquinas predeterminadas establecidas. Ajuste manualmente.');
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Move className="h-4 w-4 mr-2" />
                      Establecer Esquinas Manuales
                    </Button>
                    <Button
                      onClick={onRetry}
                      variant="outline"
                      size="sm"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Reintentar Detección
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Esquinas Confirmadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {adjustedCorners.map((corner, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'][index]
                        }}
                      />
                      <span className="font-medium">Esquina {index + 1}:</span>
                      <Badge variant="outline">
                        ({Math.round(corner.x)}, {Math.round(corner.y)})
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCornerCancellation}
                    variant="outline"
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Ajustar de Nuevo
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!cornersConfirmed && (
        <div className="flex justify-center">
          <Button
            onClick={handleAutoDetect}
            variant="outline"
            disabled={isProcessing || isDetectingCorners}
          >
            {isDetectingCorners ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Detectando...
              </>
            ) : detectedCorners.length > 0 ? (
              '🔄 Re-detectar Esquinas'
            ) : (
              '🎯 Detectar Automáticamente'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EdgeDetectionStep;
