import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Camera, FileImage, Smartphone } from 'lucide-react';

interface InputSelectionStepProps {
  onUploadClick: () => void;
  onCameraClick: () => void;
  isLoading?: boolean;
}

/**
 * Step 1: Input Selection
 * Allows user to choose between uploading an image or taking a photo
 */
export const InputSelectionStep: React.FC<InputSelectionStepProps> = ({
  onUploadClick,
  onCameraClick,
  isLoading = false
}) => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-xl">
          <FileImage className="h-6 w-6" />
          Seleccionar Imagen
        </CardTitle>
        <p className="text-sm text-gray-600">
          Elija cómo desea agregar su documento
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Option */}
        <Button
          onClick={onUploadClick}
          disabled={isLoading}
          variant="outline"
          className="w-full h-20 flex flex-col items-center gap-2 hover:bg-blue-50"
        >
          <Upload className="h-8 w-8 text-blue-600" />
          <div className="text-center">
            <div className="font-medium">Subir Imagen</div>
            <div className="text-xs text-gray-500">Seleccionar archivo del dispositivo</div>
          </div>
        </Button>

        {/* Camera Option */}
        <Button
          onClick={onCameraClick}
          disabled={isLoading}
          variant="outline"
          className="w-full h-20 flex flex-col items-center gap-2 hover:bg-green-50"
        >
          <Camera className="h-8 w-8 text-green-600" />
          <div className="text-center">
            <div className="font-medium">Tomar Foto</div>
            <div className="text-xs text-gray-500">
              {isLoading ? 'Iniciando cámara...' : 'Usar cámara del dispositivo'}
            </div>
          </div>
        </Button>

        {/* Features Preview */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Próximos pasos:
          </h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">1</Badge>
              <span>Ajuste de esquinas del documento</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">2</Badge>
              <span>Mejora de imagen y procesamiento</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">3</Badge>
              <span>Confirmación y guardado</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InputSelectionStep;
