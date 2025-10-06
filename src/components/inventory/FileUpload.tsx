'use client'

import React, { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  File, 
  Image as ImageIcon, 
  FileText, 
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Camera,
  Scan,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import ScannerModal from '@/components/inventory/ScannerModal'

// Safe File factory for environments/types where File constructor is not available in type defs
const makeFile = (blob: Blob, filename: string, type: string): File => {
  const FileCtor: any = typeof window !== 'undefined' ? (window as any).File : undefined
  if (FileCtor) {
    return new FileCtor([blob], filename, { type })
  }
  // Fallback: cast Blob to File (only used to satisfy types; runtime is browser)
  const fallback: any = blob
  fallback.name = filename
  fallback.lastModified = Date.now()
  fallback.type = type
  return fallback as File
}

interface FileUploadProps {
  onFileSelect: (files: FileList) => void
  acceptedTypes?: string[]
  multiple?: boolean
  maxFiles?: number
  maxSize?: number // in MB
  uploading?: boolean
  disabled?: boolean
  className?: string
}

interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
  isCameraCapture?: boolean
  originalImage?: string
}

interface CameraCapture {
  id: string
  imageData: string
  timestamp: Date
}

export default function FileUpload({
  onFileSelect,
  acceptedTypes = ['image/*', 'application/pdf'],
  multiple = true,
  maxFiles = 5,
  maxSize = 10,
  uploading = false,
  disabled = false,
  className
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [showCamera, setShowCamera] = useState(false)
  const [cameraCaptures, setCameraCaptures] = useState<CameraCapture[]>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [enhanceScan, setEnhanceScan] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon
    if (type === 'application/pdf') return FileText
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Camera functionality
  const startCamera = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        toast.error('La cámara requiere HTTPS o ejecutar en localhost')
        return
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        try {
          await videoRef.current.play()
        } catch (err) {
          // Some browsers auto-play muted only; video element is muted
        }
      }
      setIsCameraActive(true)
      setShowCamera(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error('No se pudo acceder a la cámara. Verifique permisos y conexión segura.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
    setShowCamera(false)
  }, [stream])

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Apply enhancement filters if enabled
    context.filter = enhanceScan ? 'grayscale(100%) contrast(1.2) brightness(1.1)' : 'none'

    // Draw video frame to canvas
    context.drawImage(video, 0, 0)

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9)
    
    const capture: CameraCapture = {
      id: Date.now().toString(),
      imageData,
      timestamp: new Date()
    }

    setCameraCaptures(prev => [...prev, capture])
  }, [enhanceScan])

  const removeCapture = useCallback((id: string) => {
    setCameraCaptures(prev => prev.filter(capture => capture.id !== id))
  }, [])

  const generatePDFFromCaptures = useCallback(async () => {
    if (cameraCaptures.length === 0) return

    try {
      // Import jsPDF dynamically to avoid SSR issues and handle different exports
      const jsPDFModule = await import('jspdf')
      const JSPDF: any = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default
      const pdf = new JSPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const imageWidth = pageWidth - (2 * margin)
      
      for (let index = 0; index < cameraCaptures.length; index++) {
        if (index > 0) {
          pdf.addPage()
        }
        
        const capture = cameraCaptures[index]
        
        // Calculate image height maintaining aspect ratio
        const img = new Image()
        img.src = capture.imageData
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const aspectRatio = img.height / img.width
            const imageHeight = imageWidth * aspectRatio
            
            // If image is too tall for one page, scale it down
            const maxHeight = pageHeight - (2 * margin)
            const finalHeight = Math.min(imageHeight, maxHeight)
            const finalWidth = finalHeight / aspectRatio
            
            // Center the image on the page
            const x = (pageWidth - finalWidth) / 2
            const y = (pageHeight - finalHeight) / 2
            
            pdf.addImage(capture.imageData, 'JPEG', x, y, finalWidth, finalHeight)
            
            // Add timestamp
            pdf.setFontSize(10)
            pdf.setTextColor(100, 100, 100)
            pdf.text(
              `Capturado: ${capture.timestamp.toLocaleString('es-MX')}`,
              margin,
              pageHeight - 10
            )
            
            resolve()
          }
        })
      }
      
      // Generate PDF blob
      const pdfBlob = pdf.output('blob')
      
      // Create file from blob
      const pdfFile = makeFile(pdfBlob, `documento_escaneado_${Date.now()}.pdf`, 'application/pdf')
      
      // Add to uploaded files
      const newFile: UploadedFile = {
        name: pdfFile.name,
        size: pdfFile.size,
        type: 'application/pdf',
        isCameraCapture: true
      }
      
      setUploadedFiles(prev => [...prev, newFile])
      
      // Create DataTransfer and call onFileSelect
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(pdfFile)
      onFileSelect(dataTransfer.files)
      
      // Clear captures after successful PDF generation
      setCameraCaptures([])
      toast.success('PDF generado correctamente desde las capturas de cámara')
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      
      // Fallback: create individual image files if PDF generation fails
      try {
        toast.info('Generando archivos de imagen como alternativa...')
        
        const imageFiles: File[] = []
        cameraCaptures.forEach((capture, index) => {
          const base64Response = fetch(capture.imageData)
          base64Response.then(res => res.blob()).then(blob => {
            const imageFile = makeFile(blob, `captura_${index + 1}_${Date.now()}.jpg`, 'image/jpeg')
            imageFiles.push(imageFile)
            
            if (imageFiles.length === cameraCaptures.length) {
              const dataTransfer = new DataTransfer()
              imageFiles.forEach(file => dataTransfer.items.add(file))
              onFileSelect(dataTransfer.files)
              
              const newFiles: UploadedFile[] = imageFiles.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type,
                isCameraCapture: true
              }))
              
              setUploadedFiles(prev => [...prev, ...newFiles])
              setCameraCaptures([])
              toast.success(`${imageFiles.length} imagen(es) agregada(s) como alternativa`)
            }
          })
        })
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        toast.error('Error al generar PDF y fallback. Las capturas se mantendrán.')
      }
    }
  }, [cameraCaptures, onFileSelect])

  const validateFiles = (files: FileList): { valid: File[], errors: string[] } => {
    const valid: File[] = []
    const newErrors: string[] = []

    if (files.length > maxFiles) {
      newErrors.push(`Máximo ${maxFiles} archivo(s) permitido(s)`)
      return { valid, errors: newErrors }
    }

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        newErrors.push(`${file.name}: Tamaño máximo ${maxSize}MB`)
        return
      }

      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0]
          return file.type.startsWith(baseType + '/')
        }
        return file.type === type
      })

      if (!isValidType) {
        newErrors.push(`${file.name}: Tipo de archivo no permitido`)
        return
      }

      valid.push(file)
    })

    return { valid, errors: newErrors }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || uploading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelection(files)
    }
  }

  const handleFileSelection = (files: FileList) => {
    const { valid, errors } = validateFiles(files)
    setErrors(errors)

    if (valid.length > 0) {
      const newFiles: UploadedFile[] = valid.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
      setUploadedFiles(prev => [...prev, ...newFiles])
      
      const dataTransfer = new DataTransfer()
      valid.forEach(file => dataTransfer.items.add(file))
      onFileSelect(dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearErrors = () => {
    setErrors([])
  }

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Camera Section */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">Captura de Cámara</h3>
          </div>
          
          <div className="flex gap-2 mb-3">
            <Button type="button" onClick={() => setScannerOpen(true)} variant="ghost" className="!bg-indigo-600 !hover:bg-indigo-700 !text-white" size="sm">
              <Scan className="h-4 w-4 mr-2" /> Abrir escáner
            </Button>
          </div>
          
          {!showCamera ? (
            <div className="space-y-3">
              <p className="text-xs text-blue-700">
                Capture documentos directamente con la cámara y conviértalos a PDF
              </p>
              <Button
                type="button"
                onClick={startCamera}
                disabled={disabled || uploading}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Camera className="h-4 w-4 mr-2" />
                Abrir Cámara
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Camera View */}
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-48 object-cover rounded-lg border border-gray-300"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              {/* Camera Controls */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={captureImage}
                  disabled={!isCameraActive}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capturar
                </Button>
                <Button
                  type="button"
                  onClick={stopCamera}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  Cerrar Cámara
                </Button>
              </div>

              {/* Enhancement toggle */}
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  id="enhance-scan"
                  type="checkbox"
                  checked={enhanceScan}
                  onChange={(e) => setEnhanceScan(e.target.checked)}
                  className="h-3 w-3"
                />
                <label htmlFor="enhance-scan">Mejorar escaneo (blanco y negro, contraste)</label>
              </div>
              
              {/* Captured Images */}
              {cameraCaptures.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-blue-700">
                      Capturas ({cameraCaptures.length})
                    </p>
                    <Button
                      type="button"
                      onClick={generatePDFFromCaptures}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Scan className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {cameraCaptures.map((capture) => (
                      <div key={capture.id} className="relative">
                        <img
                          src={capture.imageData}
                          alt="Captura"
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeCapture(capture.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card 
        className={cn(
          'border-dashed border-2 transition-colors cursor-pointer',
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400',
          errors.length > 0 ? 'border-red-300 bg-red-50' : ''
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-gray-600">Subiendo archivos...</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 text-center mb-2">
                <span className="font-medium">Haga clic para subir</span> o arrastre archivos aquí
              </p>
              <p className="text-xs text-gray-500 text-center">
                {acceptedTypes.includes('image/*') && 'Imágenes, '}
                {acceptedTypes.includes('application/pdf') && 'PDF, '}
                máximo {maxSize}MB por archivo
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearErrors}
                type="button"
                className="ml-auto h-auto p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Archivos seleccionados ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map((file, index) => {
            const Icon = getFileIcon(file.type)
            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon className="h-5 w-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                    <span className="truncate">{file.name}</span>
                    {file.isCameraCapture && (
                      <Badge variant="secondary" className="ml-2 text-xs flex-shrink-0">
                        Cámara
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {file.type.split('/')[1]?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                {file.url ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    type="button"
                    className="h-auto p-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Instructions */}
      <div className="text-xs text-gray-500">
        <p>• Formatos permitidos: {acceptedTypes.join(', ')}</p>
        <p>• Tamaño máximo por archivo: {maxSize}MB</p>
        <p>• Máximo {maxFiles} archivo(s) por entrada</p>
        <p>• Use la cámara para capturar documentos y convertirlos a PDF</p>
      </div>

      <ScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onConfirm={(pdfFile: File) => {
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(pdfFile)
          onFileSelect(dataTransfer.files)
          setUploadedFiles(prev => [...prev, { name: pdfFile.name, size: pdfFile.size, type: pdfFile.type, isCameraCapture: true }])
        }}
      />
    </div>
  )
}
