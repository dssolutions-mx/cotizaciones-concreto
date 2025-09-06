'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Camera } from 'lucide-react'
import { toast } from 'sonner'

// Import scanner system
import { scannerManager } from './scanner'

// Import step components
import InputSelectionStep from './InputSelectionStep'
import EdgeDetectionStep from './EdgeDetectionStep'
import ImageEnhancementStep from './ImageEnhancementStep'
import ConfirmationStep from './ConfirmationStep'
import { type Point } from './CornerAdjustment'

// Define the workflow steps
type WorkflowStep = 'input' | 'edge-detection' | 'enhancement' | 'confirmation';

interface ScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (file: File) => void
}

// Safe File factory for environments/types where File constructor is not available in type defs
const makeFile = (blob: Blob, filename: string, type: string): File => {
  const FileCtor: any = typeof window !== 'undefined' ? (window as any).File : undefined
  if (FileCtor) {
    return new FileCtor([blob], filename, { type })
  }
  const fallback: any = blob
  fallback.name = filename
  fallback.lastModified = Date.now()
  fallback.type = type
  return fallback as File
}

export default function ScannerModal({ open, onOpenChange, onConfirm }: ScannerModalProps) {
  // Video and canvas refs for camera functionality
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Workflow state management
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('input')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Camera state - restored from working version
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [scannerReady, setScannerReady] = useState(false)
  const [isScannerLoading, setIsScannerLoading] = useState(false)

  // Data flow state - stores data as we progress through steps
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null)
  const [extractedImage, setExtractedImage] = useState<string | null>(null)
  const [finalImage, setFinalImage] = useState<string | null>(null)
  const [qualityMetrics, setQualityMetrics] = useState<any>(null)

  // Cleanup function - restored from working version
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
    setVideoReady(false)
    setScannerReady(false)
    setCurrentStep('input')
    setOriginalImage(null)
    setCorners([])
    setProcessedCanvas(null)
    setExtractedImage(null)
    setFinalImage(null)
    setQualityMetrics(null)
    setError(null)
  }, [])

  // Video ref callback
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      videoRef.current = node
      setVideoReady(true)
    }
  }, [])

  // Initialize scanner - restored from working version
  const initializeScanner = useCallback(async () => {
    if (scannerReady) return // Already initialized

    try {
      setIsScannerLoading(true)
      console.log('🚀 Initializing scanner...')

      const initResult = await scannerManager.initialize()

      if (initResult.success) {
        setScannerReady(true)
        console.log('✅ Scanner initialized successfully')
      } else {
        console.warn('⚠️ Scanner initialization failed:', initResult.error)
        setScannerReady(false)
      }
    } catch (error) {
      console.error('❌ Scanner initialization error:', error)
      setScannerReady(false)
    } finally {
      setIsScannerLoading(false)
    }
  }, [scannerReady])

  // Start camera - restored from working version
  const startCamera = useCallback(async () => {
    if (!videoRef.current) {
      console.error('videoRef no está disponible')
      return
    }

    // Verificar si estamos en un contexto seguro
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost'
    console.log('Contexto seguro:', isSecure, 'Hostname:', window.location.hostname)

    if (!isSecure) {
      setError('La cámara requiere HTTPS o ejecutar en localhost')
      return
    }

    // Verificar si getUserMedia está disponible
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Su navegador no soporta acceso a la cámara')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      console.log('Solicitando permisos de cámara...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })

      console.log('Stream obtenido:', stream)
      console.log('Tracks del stream:', stream.getTracks())

      if (!stream || stream.getTracks().length === 0) {
        throw new Error('No se obtuvieron tracks de video del stream')
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Esperar a que el video esté listo - CRITICAL for camera initialization
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!

          const onLoadedMetadata = () => {
            console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }

          const onError = (e: any) => {
            console.error('Video error event:', e)
            video.removeEventListener('error', onError)
            reject(new Error('Error en el elemento de video'))
          }

          video.addEventListener('loadedmetadata', onLoadedMetadata)
          video.addEventListener('error', onError)

          // Intentar reproducir con manejo de errores optimizado
          const attemptPlay = async () => {
            try {
              // Primero intentar sin muted
              await video.play()
              console.log('Video iniciado correctamente')
              setIsCameraActive(true)
              resolve()
            } catch (playError: any) {
              console.log('Play sin muted falló, intentando con muted:', playError.name)

              // Si falla, intentar con muted (requerido en algunos navegadores)
              if (playError.name === 'NotAllowedError' || playError.name === 'AbortError') {
                try {
                  video.muted = true
                  await video.play()
                  console.log('Video iniciado correctamente (muted)')
                  setIsCameraActive(true)
                  resolve()
                } catch (mutedError: any) {
                  console.error('Error incluso con muted:', mutedError)
                  reject(mutedError)
                }
              } else {
                reject(playError)
              }
            }
          }

          // Iniciar el intento de reproducción
          attemptPlay()
        })
      }

      // Initialize scanner when camera is ready
      await initializeScanner()
      toast.success('Cámara activada')

    } catch (e: any) {
      console.error('getUserMedia error completo:', e)

      // Better error handling based on previous implementation
      if (e.name === 'NotAllowedError') {
        setError('Permisos de cámara denegados. Por favor permita el acceso a la cámara y recargue la página.')
      } else if (e.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en este dispositivo.')
      } else if (e.name === 'NotSupportedError') {
        setError('Su navegador no soporta acceso a la cámara.')
      } else if (e.name === 'NotReadableError') {
        setError('La cámara está siendo utilizada por otra aplicación.')
      } else {
        setError(`Error de cámara: ${e.message || 'Error desconocido'}`)
      }

      toast.error('Error al acceder a la cámara')
    } finally {
      setIsLoading(false)
    }
  }, [initializeScanner])

  // Capture image from camera
  const captureFromCamera = useCallback(async (): Promise<string> => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      throw new Error('Video or canvas not available')
    }

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get canvas context')
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0)

    // Convert to base64
    return canvas.toDataURL('image/jpeg', 0.9)
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('File reading error'))
      reader.readAsDataURL(file)
    })
  }, [])

  // Step navigation functions
  const goToInput = useCallback(() => {
    setCurrentStep('input')
  }, [])

  const goToEdgeDetection = useCallback((imageSrc: string, detectedCorners?: Point[], processedCanvas?: HTMLCanvasElement) => {
    setOriginalImage(imageSrc)
    if (detectedCorners) {
      setCorners(detectedCorners)
    }
    if (processedCanvas) {
      setProcessedCanvas(processedCanvas)
    }
    setCurrentStep('edge-detection')
  }, [])

  const goToEnhancement = useCallback((corners: Point[], extractedImage: string, qualityMetrics?: any) => {
    setCorners(corners)
    setExtractedImage(extractedImage)
    setQualityMetrics(qualityMetrics)
    setCurrentStep('enhancement')
  }, [])

  const goToConfirmation = useCallback((finalImage: string, enhancedMetrics?: any) => {
    setFinalImage(finalImage)
    if (enhancedMetrics) {
      setQualityMetrics(enhancedMetrics)
    }
    setCurrentStep('confirmation')
  }, [])

  // Handle input selection
  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [])

  // Handle camera click - simplified to just navigate, camera starts automatically
  const handleCameraClick = useCallback(async () => {
    console.log('🔄 Camera click detected, isCameraActive:', isCameraActive)

    if (!isCameraActive) {
      // Camera will be started automatically by useEffect when ready
      console.log('📹 Camera not active, will start automatically when ready')
      setCurrentStep('edge-detection')
    } else {
      console.log('📹 Camera already active, going to edge detection')
      // Camera is already active, just go to edge detection
      setCurrentStep('edge-detection')
    }
  }, [isCameraActive])

  // Handle file input change
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setIsLoading(true)
      const imageSrc = await handleFileUpload(file)
      goToEdgeDetection(imageSrc)
    } catch (error) {
      console.error('File upload error:', error)
      toast.error('Error al cargar el archivo')
    } finally {
      setIsLoading(false)
    }
  }, [handleFileUpload, goToEdgeDetection])

  // Handle final confirmation
  const handleFinalConfirm = useCallback(async (finalImageData: string) => {
    try {
      setIsLoading(true)

      // Convert base64 to blob
      const response = await fetch(finalImageData)
      const blob = await response.blob()

      // Create file
      const file = makeFile(blob, `documento_procesado_${Date.now()}.jpg`, 'image/jpeg')

      // Call the confirm callback
      onConfirm(file)
      onOpenChange(false)

      toast.success('Documento guardado exitosamente')
    } catch (error) {
      console.error('File creation failed:', error)
      toast.error('Error al guardar el documento')
    } finally {
      setIsLoading(false)
    }
  }, [onConfirm, onOpenChange])

  // Effect to initialize scanner on mount
  useEffect(() => {
    if (open) {
      initializeScanner()
    }
  }, [open, initializeScanner])

  // Effect to cleanup on unmount or close
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // Handle dialog close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      cleanup()
    }
    onOpenChange(newOpen)
  }, [cleanup, onOpenChange])

  // Camera initialization useEffect - restored from working version
  useEffect(() => {
    if (open && videoReady && scannerReady && !isCameraActive && !isLoading && !error) {
      console.log('📹 Video listo y scanner cargado, iniciando cámara...')
      startCamera()
    } else if (open && videoReady && !scannerReady && !isCameraActive) {
      console.log('⏳ Video listo pero esperando scanner...')
    }
  }, [open, videoReady, scannerReady, isCameraActive, isLoading, error]) // Removed startCamera from deps to prevent loops

  // Return JSX
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Escáner de Documentos - Paso a Paso
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Recargar página
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Cargando...</p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Hidden canvas for camera capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Video Element - only show when camera is active or in edge-detection step */}
        {(currentStep === 'edge-detection' || isCameraActive) && (
          <div className="relative mb-4">
            <div className="relative border rounded overflow-hidden bg-black mx-auto max-w-2xl">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Iniciando cámara...</p>
                  </div>
                </div>
              )}
              <video
                ref={setVideoRef}
                className="w-full h-72 object-contain"
                muted
                playsInline
                onLoadedMetadata={() => console.log('Video metadata loaded')}
                onCanPlay={() => console.log('Video can play')}
                onError={(e) => console.error('Video error:', e)}
              />

              {/* System status */}
              {(videoReady || scannerReady || isCameraActive) && (
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${videoReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Video</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${scannerReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span>Scanner</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Cámara</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step Content */}
        {!isLoading && !error && (
          <>
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-4">
                {(['input', 'edge-detection', 'enhancement', 'confirmation'] as const).map((step, index) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      currentStep === step
                        ? 'bg-blue-600 text-white'
                        : index < (['input', 'edge-detection', 'enhancement', 'confirmation'] as const).indexOf(currentStep)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    {index < 3 && (
                      <div className={`w-12 h-0.5 ${
                        index < (['input', 'edge-detection', 'enhancement', 'confirmation'] as const).indexOf(currentStep)
                          ? 'bg-green-600'
                          : 'bg-gray-300'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            {currentStep === 'input' && (
              <InputSelectionStep
                onUploadClick={handleUploadClick}
                onCameraClick={handleCameraClick}
                isLoading={isLoading}
              />
            )}

            {currentStep === 'edge-detection' && originalImage && (
              <EdgeDetectionStep
                imageSrc={originalImage}
                initialCorners={corners.length > 0 ? corners : undefined}
                processedCanvas={processedCanvas}
                onBack={goToInput}
                onNext={goToEnhancement}
                onRetry={goToInput}
                isProcessing={isLoading}
              />
            )}

            {currentStep === 'enhancement' && originalImage && extractedImage && (
              <ImageEnhancementStep
                originalImage={originalImage}
                extractedImage={extractedImage}
                corners={corners}
                qualityMetrics={qualityMetrics}
                onBack={() => setCurrentStep('edge-detection')}
                onNext={goToConfirmation}
                isProcessing={isLoading}
              />
            )}

            {currentStep === 'confirmation' && originalImage && finalImage && (
              <ConfirmationStep
                originalImage={originalImage}
                finalImage={finalImage}
                corners={corners}
                qualityMetrics={qualityMetrics}
                onBack={() => setCurrentStep('enhancement')}
                onConfirm={handleFinalConfirm}
                isProcessing={isLoading}
              />
            )}
          </>
        )}

        {/* Capture button overlay for camera */}
        {currentStep === 'edge-detection' && isCameraActive && !originalImage && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <Button
              onClick={async () => {
                try {
                  const imageSrc = await captureFromCamera()
                  goToEdgeDetection(imageSrc)
                } catch (error) {
                  console.error('Capture error:', error)
                  toast.error('Error al capturar imagen')
                }
              }}
              size="lg"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capturar Imagen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
