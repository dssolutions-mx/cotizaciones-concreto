import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Move, RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export interface Point {
  x: number;
  y: number;
}

export interface CornerAdjustmentProps {
  imageSrc: string;
  initialCorners?: Point[];
  onCornersAdjusted: (corners: Point[]) => void;
  onCancel: () => void;
  onConfirm: (corners: Point[]) => void;
  width?: number;
  height?: number;
}

/**
 * Corner Adjustment Component
 * Allows users to manually adjust document corners detected by edge detection
 */
export const CornerAdjustment: React.FC<CornerAdjustmentProps> = ({
  imageSrc,
  initialCorners = [],
  onCornersAdjusted,
  onCancel,
  onConfirm,
  width = 400,
  height = 300
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [corners, setCorners] = useState<Point[]>(initialCorners);
  const [draggedCorner, setDraggedCorner] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Corner colors for visual distinction
  const cornerColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

  // Load image and set up canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Calculate canvas dimensions maintaining aspect ratio to match EdgeDetectionStep logic
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let canvasWidth = width;
      let canvasHeight = height;

      if (aspectRatio > width / height) {
        canvasHeight = width / aspectRatio;
      } else {
        canvasWidth = height * aspectRatio;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Calculate scaling and offset to center the image (matching EdgeDetectionStep logic)
      const scaleX = canvasWidth / img.naturalWidth;
      const scaleY = canvasHeight / img.naturalHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;
      const offsetX = (canvasWidth - scaledWidth) / 2;
      const offsetY = (canvasHeight - scaledHeight) / 2;

      // Clear canvas and draw image with proper scaling
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      setImageDimensions({ width: canvasWidth, height: canvasHeight });
      setImageLoaded(true);

      console.log('📐 CornerAdjustment canvas setup:', {
        originalImage: `${img.naturalWidth}x${img.naturalHeight}`,
        canvasSize: `${canvasWidth}x${canvasHeight}`,
        scale: scale.toFixed(4),
        offset: `${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`,
        scaledImage: `${scaledWidth.toFixed(1)}x${scaledHeight.toFixed(1)}`
      });

      // Initialize corners if not provided
      if (corners.length === 0) {
        const defaultCorners = [
          { x: canvasWidth * 0.1, y: canvasHeight * 0.1 }, // Top-left
          { x: canvasWidth * 0.9, y: canvasHeight * 0.1 }, // Top-right
          { x: canvasWidth * 0.9, y: canvasHeight * 0.9 }, // Bottom-right
          { x: canvasWidth * 0.1, y: canvasHeight * 0.9 }  // Bottom-left
        ];
        setCorners(defaultCorners);
      }
    };
    img.src = imageSrc;
  }, [imageSrc, width, height, corners.length]);

  // Redraw canvas with corners
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw image with the same scaling logic as initialization
    const img = new Image();
    img.onload = () => {
      // Calculate the same scaling used during initialization
      const scaleX = canvas.width / img.naturalWidth;
      const scaleY = canvas.height / img.naturalHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;
      const offsetX = (canvas.width - scaledWidth) / 2;
      const offsetY = (canvas.height - scaledHeight) / 2;

      // Clear and redraw with proper scaling
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      // Draw corners
      corners.forEach((corner, index) => {
        const color = cornerColors[index];

        // Draw corner circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw corner outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw corner label
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, corner.x, corner.y + 4);
      });

      // Draw connecting lines between corners
      if (corners.length === 4) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();

        corners.forEach((corner, index) => {
          const nextCorner = corners[(index + 1) % 4];
          if (index === 0) {
            ctx.moveTo(corner.x, corner.y);
          } else {
            ctx.lineTo(corner.x, corner.y);
          }
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    img.src = imageSrc;
  }, [corners, imageLoaded, imageSrc, cornerColors]);

  // Redraw when corners change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle mouse/touch events
  const getMousePos = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mousePos = getMousePos(canvas, e);

    // Check if clicking on a corner
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i];
      const distance = Math.sqrt(
        Math.pow(mousePos.x - corner.x, 2) + Math.pow(mousePos.y - corner.y, 2)
      );

      if (distance < 15) { // 15px radius for corner detection
        setDraggedCorner(i);
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedCorner === null) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mousePos = getMousePos(canvas, e);

    // Constrain to canvas bounds
    const constrainedPos = {
      x: Math.max(0, Math.min(canvas.width, mousePos.x)),
      y: Math.max(0, Math.min(canvas.height, mousePos.y))
    };

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggedCorner] = constrainedPos;
      return newCorners;
    });

    onCornersAdjusted(corners);
  };

  const handleMouseUp = () => {
    setDraggedCorner(null);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY
    } as React.MouseEvent;

    handleMouseDown(mouseEvent);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedCorner === null) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY
    } as React.MouseEvent;

    handleMouseMove(mouseEvent);
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // Reset corners to initial positions
  const handleReset = () => {
    if (initialCorners.length > 0) {
      setCorners(initialCorners);
      toast.success('Esquinas restablecidas a posiciones originales');
    } else {
      // Reset to default positions
      const canvas = canvasRef.current;
      if (canvas) {
        const defaultCorners = [
          { x: canvas.width * 0.1, y: canvas.height * 0.1 },
          { x: canvas.width * 0.9, y: canvas.height * 0.1 },
          { x: canvas.width * 0.9, y: canvas.height * 0.9 },
          { x: canvas.width * 0.1, y: canvas.height * 0.9 }
        ];
        setCorners(defaultCorners);
        toast.success('Esquinas restablecidas a posiciones por defecto');
      }
    }
  };

  // Auto-detect corners using the scanner
  const handleAutoDetect = async () => {
    try {
      // Import scanner dynamically to avoid circular dependencies
      const { scannerManager } = await import('./scanner');

      // Create a temporary canvas with the image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const img = new Image();
      img.onload = async () => {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);

        // Try to detect document edges
        try {
          const result = await scannerManager.detectDocumentAdvanced(tempCanvas, false);

          if (result.success && result.corners) {
            // Scale corners to canvas dimensions
            const scaleX = imageDimensions.width / img.width;
            const scaleY = imageDimensions.height / img.height;

            const scaledCorners = result.corners.map(corner => ({
              x: corner.x * scaleX,
              y: corner.y * scaleY
            }));

            setCorners(scaledCorners);
            toast.success('Esquinas detectadas automáticamente');
          } else {
            toast.error('No se pudieron detectar esquinas automáticamente');
          }
        } catch (error) {
          console.error('Auto-detection failed:', error);
          toast.error('Error en detección automática');
        }
      };
      img.src = imageSrc;
    } catch (error) {
      console.error('Failed to import scanner:', error);
      toast.error('Error al cargar detector automático');
    }
  };

  const handleConfirmCorners = () => {
    onConfirm(corners);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Move className="h-5 w-5" />
          Ajustar Esquinas del Documento
        </CardTitle>
        <p className="text-sm text-gray-600">
          Arrastra los círculos numerados para ajustar las esquinas del documento
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Canvas for corner adjustment */}
        <div className="flex justify-center">
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="cursor-crosshair touch-none"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        </div>

        {/* Corner coordinates display */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {corners.map((corner, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: cornerColors[index] }}
              />
              <span className="font-medium">Esquina {index + 1}:</span>
              <Badge variant="outline">
                ({Math.round(corner.x)}, {Math.round(corner.y)})
              </Badge>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            onClick={handleAutoDetect}
            variant="outline"
            size="sm"
          >
            🎯 Detectar Automáticamente
          </Button>

          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restablecer
          </Button>

          <Button
            onClick={onCancel}
            variant="outline"
            size="sm"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>

          <Button
            onClick={handleConfirmCorners}
            size="sm"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar Esquinas
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <strong>Instrucciones:</strong>
          <ul className="mt-1 space-y-1">
            <li>• Arrastra los círculos numerados para ajustar las esquinas</li>
            <li>• El orden debe ser: superior-izquierda, superior-derecha, inferior-derecha, inferior-izquierda</li>
            <li>• Usa "Detectar Automáticamente" para obtener una sugerencia inicial</li>
            <li>• Haz clic en "Confirmar Esquinas" cuando estés satisfecho</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default CornerAdjustment;
