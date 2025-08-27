'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Camera, FileText, Scan, X } from 'lucide-react'
import { toast } from 'sonner'

declare global {
  interface Window {
    jscanify?: any
    cv?: any
  }
}

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [captures, setCaptures] = useState<string[]>([])
  const [processedCaptures, setProcessedCaptures] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [scannerReady, setScannerReady] = useState(false)
  const [isScannerLoading, setIsScannerLoading] = useState(false)
  const [processingPreview, setProcessingPreview] = useState<string | null>(null)
  const [processingStats, setProcessingStats] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const scannerRef = useRef<any>(null)

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
    setVideoReady(false)
    setScannerReady(false)
    scannerRef.current = null
  }, [])

  // Ref callback para detectar cuando el video está montado
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      videoRef.current = node
      setVideoReady(true)
    }
  }, [])

  // Utilidad para cargar scripts externos con mejor manejo de errores y cache
  const loadScript = useCallback((src: string, retries: number = 2) => {
    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
      if (existing) {
        if ((existing as any)._loaded) {
          return resolve()
        }
        // Si existe pero no está cargado, esperar o crear nuevo
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => {
          existing.remove()
          loadScript(src, retries).then(resolve).catch(reject)
        })
        return
      }

      const script = document.createElement('script')
      ;(script as any)._loaded = false
      script.src = src
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'

      const cleanup = () => {
        script.onload = null
        script.onerror = null
      }

      script.onload = () => {
        ;(script as any)._loaded = true
        cleanup()
        resolve()
      }

      script.onerror = () => {
        cleanup()
        script.remove()
        if (retries > 0) {
          console.log(`Reintentando carga de ${src}, ${retries} intentos restantes`)
          setTimeout(() => {
            loadScript(src, retries - 1).then(resolve).catch(reject)
          }, 1000)
        } else {
          reject(new Error(`Failed to load script after retries: ${src}`))
        }
      }

      document.head.appendChild(script)
    })
  }, [])

  // PASO 1: Cargar OpenCV.js primero (siempre necesario)
  const loadOpenCV = useCallback(async (): Promise<boolean> => {
    if (typeof window.cv !== 'undefined') {
      console.log('✅ OpenCV.js ya está disponible')
      return true
    }

    console.log('📦 PASO 1: Cargando OpenCV.js...')
    const opencvUrls = [
      'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js', // ✅ Working URL first
      'https://docs.opencv.org/4.7.0/opencv.js',
      'https://unpkg.com/opencv.js@1.2.1/opencv.js'
    ]

    for (const url of opencvUrls) {
      try {
        console.log(`Intentando cargar OpenCV desde: ${url}`)
        await loadScript(url)

        // Esperar hasta 20 segundos a que OpenCV esté completamente listo
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('OpenCV initialization timeout')), 20000)
          const checkOpenCV = () => {
            if (typeof window.cv !== 'undefined') {
              clearTimeout(timeout)
              resolve()
            } else {
              setTimeout(checkOpenCV, 200) // Check every 200ms
            }
          }
          checkOpenCV()
        })

        console.log(`✅ OpenCV.js cargado y listo desde: ${url}`)
        return true
      } catch (e) {
        console.warn(`❌ Falló cargar OpenCV desde ${url}:`, e)
      }
    }

    console.error('❌ No se pudo cargar OpenCV.js desde ningún CDN')
    return false
  }, [loadScript])

  // PASO 2: Cargar jscanify después de OpenCV
  const loadJScanify = useCallback(async (): Promise<boolean> => {
    if (typeof window.jscanify !== 'undefined') {
      console.log('✅ jscanify ya está disponible')
      return true
    }

    console.log('📦 PASO 2: Cargando jscanify...')
    const cdnUrls = [
      'https://cdn.jsdelivr.net/gh/puffinsoft/jscanify@master/src/jscanify.min.js',
      'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js',
      'https://unpkg.com/jscanify@1.4.0/src/jscanify.min.js'
    ]

    for (const url of cdnUrls) {
      try {
        console.log(`Intentando cargar jscanify desde: ${url}`)
        await loadScript(url)
        console.log(`✅ jscanify cargado desde: ${url}`)
        return true
      } catch (e) {
        console.warn(`❌ Falló cargar jscanify desde ${url}:`, e)
      }
    }

    console.error('❌ No se pudo cargar jscanify desde ningún CDN')
    return false
  }, [loadScript])

  // PASO 3: Inicializar scanner después de cargar ambas bibliotecas
  const initializeScanner = useCallback(async (): Promise<boolean> => {
    if (!window.jscanify) {
      throw new Error('jscanify no está disponible')
    }

    console.log('📦 PASO 3: Inicializando scanner...')

    try {
      const ScannerCtor = window.jscanify
      const scanner = new ScannerCtor()

      // jscanify constructor should automatically find OpenCV if it's loaded
      // No need for separate loadOpenCV call - just verify it works
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Scanner initialization timeout')), 5000)

        // Test if scanner can access OpenCV by trying a simple operation
        try {
          // If scanner has extractPaper method, it's properly initialized
          if (typeof scanner.extractPaper === 'function') {
            clearTimeout(timeout)
            resolve()
          } else {
            clearTimeout(timeout)
            reject(new Error('Scanner does not have extractPaper method'))
          }
        } catch (e) {
          clearTimeout(timeout)
          reject(new Error(`Scanner initialization failed: ${e}`))
        }
      })

      scannerRef.current = scanner
      console.log('✅ Scanner inicializado correctamente')
      return true

    } catch (e) {
      console.error('❌ Error inicializando scanner:', e)
      throw new Error(`Scanner initialization failed: ${e}`)
    }
  }, [])

  // Cargar scanner completo en secuencia correcta
  const loadScanner = useCallback(async () => {
    // Evitar carga duplicada
    if (scannerRef.current || scannerReady || isScannerLoading) {
      console.log('🔄 Scanner ya cargado o cargando, omitiendo...')
      return
    }
    if (typeof window === 'undefined') return

    try {
      setIsScannerLoading(true)
      console.log('🚀 Iniciando carga secuencial del scanner...')

      // PASO 1: Cargar OpenCV primero
      const opencvSuccess = await loadOpenCV()
      if (!opencvSuccess) {
        throw new Error('OpenCV loading failed')
      }

      // PASO 2: Cargar jscanify después
      const jscanifySuccess = await loadJScanify()
      if (!jscanifySuccess) {
        throw new Error('jscanify loading failed')
      }

      // PASO 3: Inicializar scanner
      await initializeScanner()

      setScannerReady(true)
      console.log('🎉 Scanner completamente listo con procesamiento automático')
      toast.success('Procesamiento automático de documentos activado')

    } catch (e: any) {
      console.error('❌ Error en carga secuencial:', e)
      setScannerReady(false)

      // Determinar tipo de error y mostrar mensaje apropiado
      if (e.message?.includes('OpenCV')) {
        setError('Error cargando OpenCV. Usando procesamiento básico.')
        toast.warning('Procesamiento automático no disponible, usando modo básico.')
      } else if (e.message?.includes('jscanify')) {
        setError('Error cargando jscanify. Usando procesamiento básico.')
        toast.warning('Procesamiento automático no disponible, usando modo básico.')
      } else {
        setError('Error en inicialización del scanner. Usando procesamiento básico.')
        toast.info('Usando procesamiento básico - las imágenes serán optimizadas automáticamente.')
      }
    } finally {
      setIsScannerLoading(false)
    }
  }, [loadOpenCV, loadJScanify, initializeScanner]) // Removido scannerReady, isScannerLoading

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
      
      // Forzar la solicitud de permisos
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
        
        // Esperar a que el video esté listo
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
          
          // Intentar reproducir una sola vez con manejo de errores optimizado
          const attemptPlay = async () => {
            try {
              // Primero intentar sin muted
              await video.play()
              console.log('Video iniciado correctamente')
              setIsCameraActive(true)
            } catch (playError: any) {
              console.log('Play sin muted falló, intentando con muted:', playError.name)
              
              // Si falla, intentar con muted (requerido en algunos navegadores)
              if (playError.name === 'NotAllowedError' || playError.name === 'AbortError') {
                try {
                  video.muted = true
                  await video.play()
                  console.log('Video iniciado correctamente (muted)')
                  setIsCameraActive(true)
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
    } catch (e: any) {
      console.error('getUserMedia error completo:', e)
      if (e.name === 'NotAllowedError') {
        setError('Permisos de cámara denegados. Por favor, permita el acceso a la cámara y recargue la página.')
      } else if (e.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en el dispositivo.')
      } else if (e.name === 'NotSupportedError') {
        setError('Su navegador no soporta acceso a la cámara.')
      } else if (e.name === 'NotReadableError') {
        setError('La cámara está siendo usada por otra aplicación.')
      } else {
        setError(`Error al acceder a la cámara: ${e.name} - ${e.message || 'Error desconocido'}`)
      }
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleOpenChange = useCallback(async (next: boolean) => {
    onOpenChange(next)
  }, [onOpenChange])

  // PASO 1: Cargar scanner UNA SOLA VEZ cuando se abre el modal
  useEffect(() => {
    if (!open) return

    console.log('📱 Modal abierto, iniciando carga del scanner...')
    loadScanner()

    return () => {
      // Cleanup cuando se cierra el modal
      cleanup()
    }
  }, [open, loadScanner, cleanup]) // Solo open, loadScanner y cleanup

  // PASO 2: Iniciar cámara cuando el video esté listo Y el scanner esté cargado
  useEffect(() => {
    if (open && videoReady && scannerReady && !isCameraActive && !isLoading && !error) {
      console.log('📹 Video listo y scanner cargado, iniciando cámara...')
      startCamera()
    } else if (open && videoReady && !scannerReady && !isCameraActive) {
      console.log('⏳ Video listo pero esperando scanner...')
    }
  }, [open, videoReady, scannerReady, isCameraActive, isLoading, error, startCamera])

  // 🎯 Detectar esquinas del documento mejorado (preview)
  const detectDocumentCorners = useCallback(async (imageData: string): Promise<{ corners: any[], highlightedImage: string } | null> => {
    if (!scannerRef.current || !scannerReady) {
      return null
    }
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageData
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Error loading image'))
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      console.log('🔍 Aplicando mejoras de detección de documentos...')

      // Aplicar pre-procesamiento para mejorar detección
      const preprocessedCanvas = await preprocessImageForDetection(canvas)
      
      // Intentar múltiples métodos de detección
      let highlightedCanvas = null
      let corners = []

      // Método 1: highlightPaper estándar
      try {
        highlightedCanvas = scannerRef.current.highlightPaper(preprocessedCanvas)
        console.log('✅ highlightPaper aplicado')
      } catch (e) {
        console.warn('highlightPaper falló:', e)
        highlightedCanvas = preprocessedCanvas
      }

      // Método 2: Intentar detectar contornos manualmente
      try {
        if (scannerRef.current.findPaperContour) {
          const contour = scannerRef.current.findPaperContour(preprocessedCanvas)
          if (contour && contour.length >= 4) {
            corners = contour
            console.log(`✅ Contorno detectado con ${corners.length} puntos`)
            
            // Dibujar contorno manualmente si jscanify no lo resalta bien
            highlightedCanvas = drawEnhancedContour(preprocessedCanvas, corners)
          }
        }
      } catch (e) {
        console.log('findPaperContour no disponible:', e)
      }

      // Método 3: Detección de bordes mejorada como fallback
      if (!corners.length) {
        console.log('🔄 Aplicando detección de bordes avanzada...')
        const enhancedResult = await enhancedEdgeDetection(preprocessedCanvas)
        if (enhancedResult) {
          corners = enhancedResult.corners
          highlightedCanvas = enhancedResult.highlightedCanvas
          console.log(`✅ Detección avanzada encontró ${corners.length} esquinas`)
        }
      }

      return {
        corners,
        highlightedImage: (highlightedCanvas || canvas).toDataURL('image/jpeg', 0.9)
      }
    } catch (e) {
      console.error('Error detecting corners:', e)
      return null
    }
  }, [scannerReady])

  // 🔧 Pre-procesamiento para mejorar detección
  const preprocessImageForDetection = useCallback(async (canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    const processedCanvas = document.createElement('canvas')
    const processedCtx = processedCanvas.getContext('2d')
    if (!processedCtx) return canvas

    processedCanvas.width = canvas.width
    processedCanvas.height = canvas.height
    processedCtx.drawImage(canvas, 0, 0)

    const imageData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height)
    const data = imageData.data

    // Aumentar contraste y claridad para mejor detección de bordes
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      // Aumentar contraste dramáticamente
      const contrast = 2.0
      r = ((r - 128) * contrast) + 128
      g = ((g - 128) * contrast) + 128
      b = ((b - 128) * contrast) + 128

      // Aplicar umbralización suave para resaltar papel vs fondo
      const avg = (r + g + b) / 3
      if (avg > 180) {
        // Área clara (papel) - hacer más blanca
        r = Math.min(255, r * 1.2)
        g = Math.min(255, g * 1.2)  
        b = Math.min(255, b * 1.2)
      } else if (avg < 100) {
        // Área oscura (fondo) - hacer más oscura
        r = Math.max(0, r * 0.7)
        g = Math.max(0, g * 0.7)
        b = Math.max(0, b * 0.7)
      }

      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
    }

    processedCtx.putImageData(imageData, 0, 0)
    return processedCanvas
  }, [])

  // 🎨 Dibujar contorno mejorado con información de confianza
  const drawEnhancedContour = useCallback((canvas: HTMLCanvasElement, corners: any[]): HTMLCanvasElement => {
    const resultCanvas = document.createElement('canvas')
    const ctx = resultCanvas.getContext('2d')
    if (!ctx) return canvas

    resultCanvas.width = canvas.width
    resultCanvas.height = canvas.height
    ctx.drawImage(canvas, 0, 0)

    if (corners.length >= 3) {
      // Dibujar líneas del contorno con gradiente según confianza
      const avgConfidence = corners.reduce((sum, c) => sum + (c.confidence || 50), 0) / corners.length
      const lineColor = avgConfidence > 70 ? '#00ff00' : avgConfidence > 50 ? '#ff6b35' : '#ff0000'
      
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 6
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Dibujar contorno principal
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()
      ctx.stroke()

      // Dibujar línea interior más fina
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.shadowBlur = 0
      ctx.stroke()

      // Dibujar esquinas con tamaño basado en confianza
      corners.forEach((corner, idx) => {
        const confidence = corner.confidence || 50
        const radius = 6 + (confidence / 100) * 6 // Radio de 6-12 según confianza
        
        // Color de esquina según confianza
        const cornerColor = confidence > 70 ? '#00ff00' : confidence > 50 ? '#ff6b35' : '#ff0000'
        
        // Círculo exterior (sombra)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.arc(corner.x + 1, corner.y + 1, radius + 2, 0, 2 * Math.PI)
        ctx.fill()
        
        // Círculo principal
        ctx.fillStyle = cornerColor
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, radius, 0, 2 * Math.PI)
        ctx.fill()
        
        // Círculo interior blanco
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, radius - 2, 0, 2 * Math.PI)
        ctx.fill()
        
        // Número de esquina
        ctx.fillStyle = '#333'
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((idx + 1).toString(), corner.x, corner.y)
        
        // Información de confianza (pequeña)
        if (corner.confidence) {
          ctx.fillStyle = cornerColor
          ctx.font = 'bold 8px Arial'
          ctx.fillText(`${Math.round(confidence)}%`, corner.x, corner.y + radius + 12)
        }
        
        // Región de esquina (debug)
        if (corner.region) {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.font = '8px Arial'
          ctx.fillText(corner.region, corner.x - radius - 15, corner.y - radius - 8)
        }
      })

      // Dibujar información de calidad en la esquina superior
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.fillRect(10, 10, 180, 60)
      
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText('Detección de Esquinas:', 15, 25)
      
      ctx.font = '10px Arial'
      ctx.fillText(`Esquinas: ${corners.length}/4`, 15, 40)
      ctx.fillText(`Confianza promedio: ${Math.round(avgConfidence)}%`, 15, 52)
      
      const qualityText = avgConfidence > 70 ? 'EXCELENTE' : avgConfidence > 50 ? 'BUENA' : 'BÁSICA'
      ctx.fillStyle = lineColor
      ctx.font = 'bold 10px Arial'
      ctx.fillText(`Calidad: ${qualityText}`, 15, 64)
    } else {
      // Si hay menos de 3 esquinas, mostrar mensaje de advertencia
      ctx.fillStyle = 'rgba(255,0,0,0.8)'
      ctx.fillRect(10, 10, 200, 40)
      
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText('⚠️ Detección insuficiente', 15, 25)
      ctx.font = '10px Arial'
      ctx.fillText(`Solo ${corners.length} esquinas detectadas`, 15, 37)
    }

    return resultCanvas
  }, [])

  // 🔍 Detección de bordes avanzada como fallback
  const enhancedEdgeDetection = useCallback(async (canvas: HTMLCanvasElement): Promise<{ corners: any[], highlightedCanvas: HTMLCanvasElement } | null> => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    console.log('🔍 Iniciando detección avanzada de esquinas...')

    // Aplicar filtro Sobel para detección de bordes más precisa
    const sobelData = applySobelFilter(imageData)
    
    // Detectar bordes usando múltiples técnicas
    const edges = []
    const threshold = 30 // Umbral más sensible

    // Búsqueda de bordes con paso más fino
    for (let y = 20; y < height - 20; y += 2) {
      for (let x = 20; x < width - 20; x += 2) {
        const idx = y * width + x
        const sobelValue = sobelData[idx]
        
        if (sobelValue > threshold) {
          // Calcular la intensidad del borde local
          const localIntensity = calculateLocalEdgeIntensity(data, x, y, width, height)
          edges.push({ 
            x, 
            y, 
            strength: sobelValue + localIntensity,
            sobel: sobelValue,
            local: localIntensity
          })
        }
      }
    }

    console.log(`📊 Encontrados ${edges.length} puntos de borde`)

    if (edges.length < 50) {
      console.log('❌ Insuficientes puntos de borde detectados')
      return null
    }

    // Filtrar bordes por fortaleza (mantener solo los más fuertes)
    const sortedEdges = edges.sort((a, b) => b.strength - a.strength)
    const strongEdges = sortedEdges.slice(0, Math.min(200, Math.floor(edges.length * 0.3)))

    // Encontrar esquinas usando algoritmo mejorado
    const corners = findOptimalCorners(strongEdges, width, height)
    
    console.log(`🎯 Esquinas detectadas: ${corners.length}`)
    corners.forEach((corner, idx) => {
      console.log(`  Esquina ${idx + 1}: (${corner.x}, ${corner.y}) - Confianza: ${corner.confidence}`)
    })

    if (corners.length >= 3) {
      // Ordenar esquinas en sentido horario desde la superior izquierda
      const orderedCorners = orderCornersClockwise(corners, width, height)
      
      return {
        corners: orderedCorners,
        highlightedCanvas: drawEnhancedContour(canvas, orderedCorners)
      }
    }

    return null
  }, [])

  // 🔧 Aplicar filtro Sobel para detección de bordes
  const applySobelFilter = useCallback((imageData: ImageData): number[] => {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const result = new Array(width * height).fill(0)

    // Kernels Sobel
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0

        // Aplicar kernel Sobel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            
            gx += gray * sobelX[kernelIdx]
            gy += gray * sobelY[kernelIdx]
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy)
        result[y * width + x] = magnitude
      }
    }

    return result
  }, [])

  // 🎯 Calcular intensidad de borde local
  const calculateLocalEdgeIntensity = useCallback((data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const radius = 5
    let maxDiff = 0

    const centerIdx = (y * width + x) * 4
    const centerBrightness = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3

    // Verificar en todas las direcciones alrededor del punto
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const newX = x + dx
        const newY = y + dy
        
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const idx = (newY * width + newX) * 4
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          const diff = Math.abs(centerBrightness - brightness)
          maxDiff = Math.max(maxDiff, diff)
        }
      }
    }

    return maxDiff
  }, [])

  // 🎯 Encontrar esquinas óptimas
  const findOptimalCorners = useCallback((edges: any[], width: number, height: number): any[] => {
    const margin = Math.min(width, height) * 0.1 // 10% del tamaño mínimo como margen
    const quadrantWidth = width / 2
    const quadrantHeight = height / 2

    // Definir regiones más precisas para cada esquina
    const regions = [
      // Superior izquierda
      { 
        name: 'TL',
        filter: (e: any) => e.x < quadrantWidth && e.y < quadrantHeight,
        score: (e: any) => -(e.x + e.y) + e.strength * 0.1 // Priorizar esquina + fortaleza
      },
      // Superior derecha
      { 
        name: 'TR',
        filter: (e: any) => e.x > quadrantWidth && e.y < quadrantHeight,
        score: (e: any) => -(width - e.x + e.y) + e.strength * 0.1
      },
      // Inferior derecha
      { 
        name: 'BR',
        filter: (e: any) => e.x > quadrantWidth && e.y > quadrantHeight,
        score: (e: any) => -(width - e.x + height - e.y) + e.strength * 0.1
      },
      // Inferior izquierda
      { 
        name: 'BL',
        filter: (e: any) => e.x < quadrantWidth && e.y > quadrantHeight,
        score: (e: any) => -(e.x + height - e.y) + e.strength * 0.1
      }
    ]

    const corners = []

    regions.forEach(region => {
      const candidates = edges.filter(region.filter)
      
      if (candidates.length > 0) {
        // Encontrar los mejores candidatos en esta región
        const scored = candidates.map(e => ({
          ...e,
          regionScore: region.score(e),
          confidence: Math.min(100, (e.strength / 100) * 100)
        }))
        
        // Tomar el mejor candidato
        const best = scored.sort((a, b) => b.regionScore - a.regionScore)[0]
        
        // Verificar que esté suficientemente lejos de otras esquinas ya encontradas
        const tooClose = corners.some(corner => 
          Math.sqrt(Math.pow(corner.x - best.x, 2) + Math.pow(corner.y - best.y, 2)) < margin
        )
        
        if (!tooClose) {
          corners.push({
            x: best.x,
            y: best.y,
            region: region.name,
            confidence: best.confidence,
            strength: best.strength
          })
        }
      }
    })

    return corners
  }, [])

  // 🔄 Ordenar esquinas en sentido horario
  const orderCornersClockwise = useCallback((corners: any[], width: number, height: number): any[] => {
    if (corners.length < 3) return corners

    const centerX = width / 2
    const centerY = height / 2

    // Calcular ángulo desde el centro para cada esquina
    const withAngles = corners.map(corner => ({
      ...corner,
      angle: Math.atan2(corner.y - centerY, corner.x - centerX)
    }))

    // Ordenar por ángulo (sentido horario)
    return withAngles.sort((a, b) => a.angle - b.angle)
  }, [])

  // 🖼️ Procesar imagen con jscanify (versión avanzada)
  const processImageWithJScanify = useCallback(async (imageData: string, options?: {
    targetWidth?: number
    targetHeight?: number
    quality?: number
    enhance?: boolean
    autoCrop?: boolean
  }): Promise<{
    processedImage: string
    originalCorners?: any[]
    processingStats: {
      method: string
      quality: number
      dimensions: { width: number; height: number }
      processingTime: number
    }
  }> => {
    const startTime = performance.now()

    if (!scannerRef.current || !scannerReady) {
      throw new Error('Scanner not available')
    }

    try {
      // Crear imagen desde base64
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageData
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Error loading image'))
      })

      // Canvas temporal para procesar
      const tempCanvas = document.createElement('canvas')
      const ctx = tempCanvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      tempCanvas.width = img.width
      tempCanvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // Opciones por defecto
      const config = {
        targetWidth: 1080,
        targetHeight: 1528,
        quality: 0.95,
        enhance: true,
        autoCrop: true,
        ...options
      }

      console.log(`🔄 Procesando imagen con jscanify (${img.width}x${img.height})...`)

      let processedCanvas: HTMLCanvasElement

      if (config.autoCrop && scannerRef.current.extractPaper) {
        try {
          // Pre-procesar imagen para mejor detección
          const preprocessedCanvas = await preprocessImageForDetection(tempCanvas)
          console.log('🔧 Pre-procesamiento aplicado para mejor detección')
          
          // Intentar extraer documento con imagen pre-procesada
          processedCanvas = scannerRef.current.extractPaper(preprocessedCanvas, config.targetWidth, config.targetHeight)
          console.log('✅ Documento extraído con pre-procesamiento')
          
          // Si el resultado es muy pequeño, intentar con imagen original
          if (processedCanvas.width < config.targetWidth * 0.3 || processedCanvas.height < config.targetHeight * 0.3) {
            console.log('⚠️ Resultado muy pequeño, intentando con imagen original...')
            processedCanvas = scannerRef.current.extractPaper(tempCanvas, config.targetWidth, config.targetHeight)
          }
        } catch (e) {
          console.warn('extractPaper con pre-procesamiento falló, usando imagen original:', e)
          try {
            processedCanvas = scannerRef.current.extractPaper(tempCanvas, config.targetWidth, config.targetHeight)
            console.log('✅ Documento extraído con imagen original')
          } catch (e2) {
            console.warn('extractPaper falló completamente, usando imagen sin recortar:', e2)
            processedCanvas = tempCanvas
          }
        }
      } else {
        // Solo mejorar la imagen sin recortar
        processedCanvas = tempCanvas
      }

      // Aplicar mejoras adicionales si está habilitado
      if (config.enhance) {
        const enhancedCanvas = await enhanceImage(processedCanvas, {
          brightness: 1.1,
          contrast: 1.2,
          sharpness: 0.3,
          denoise: true
        })
        processedCanvas = enhancedCanvas
        console.log('✅ Mejoras aplicadas (brillo, contraste, nitidez)')
      }

      const processedImageData = processedCanvas.toDataURL('image/jpeg', config.quality)

      const processingTime = performance.now() - startTime

      console.log(`✅ Procesamiento completado en ${processingTime.toFixed(2)}ms`)

      return {
        processedImage: processedImageData,
        processingStats: {
          method: config.autoCrop ? 'extractPaper + enhance' : 'enhance only',
          quality: config.quality,
          dimensions: {
            width: processedCanvas.width,
            height: processedCanvas.height
          },
          processingTime
        }
      }
    } catch (e) {
      console.error('❌ Error procesando imagen con jscanify:', e)
      throw new Error(`Processing failed: ${e}`)
    }
  }, [scannerReady])

  // 🎨 Mejorar imagen con filtros avanzados
  const enhanceImage = useCallback(async (canvas: HTMLCanvasElement, options: {
    brightness?: number
    contrast?: number
    sharpness?: number
    denoise?: boolean
  } = {}): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(canvas)
        return
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      const config = {
        brightness: 1.0,
        contrast: 1.0,
        sharpness: 0.0,
        denoise: false,
        ...options
      }

      // Aplicar mejoras pixel por pixel
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]
        let g = data[i + 1]
        let b = data[i + 2]

        // Brillo
        if (config.brightness !== 1.0) {
          r *= config.brightness
          g *= config.brightness
          b *= config.brightness
        }

        // Contraste
        if (config.contrast !== 1.0) {
          r = ((r - 128) * config.contrast) + 128
          g = ((g - 128) * config.contrast) + 128
          b = ((b - 128) * config.contrast) + 128
        }

        // Reducción de ruido básica
        if (config.denoise) {
          // Filtro de mediana simple para reducir ruido
          const neighbors = []
          const directions = [-4, 4, -canvas.width * 4, canvas.width * 4]

          for (const dir of directions) {
            if (i + dir >= 0 && i + dir < data.length) {
              neighbors.push(data[i + dir], data[i + dir + 1], data[i + dir + 2])
            }
          }

          if (neighbors.length >= 6) {
            // Usar mediana para reducir ruido
            neighbors.sort((a, b) => a - b)
            r = neighbors[Math.floor(neighbors.length / 2)]
            g = neighbors[Math.floor(neighbors.length / 2) + 1] || g
            b = neighbors[Math.floor(neighbors.length / 2) + 2] || b
          }
        }

        // Clamp values
        data[i] = Math.max(0, Math.min(255, r))
        data[i + 1] = Math.max(0, Math.min(255, g))
        data[i + 2] = Math.max(0, Math.min(255, b))
      }

      // Aplicar nitidez si está configurada
      if (config.sharpness > 0) {
        const sharpened = applySharpenFilter(imageData, config.sharpness)
        ctx.putImageData(sharpened, 0, 0)
      } else {
        ctx.putImageData(imageData, 0, 0)
      }

      resolve(canvas)
    })
  }, [])

  // 🔍 Aplicar filtro de nitidez
  const applySharpenFilter = useCallback((imageData: ImageData, intensity: number): ImageData => {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const output = new Uint8ClampedArray(data)
    const kernel = [
      0, -intensity, 0,
      -intensity, 1 + 4 * intensity, -intensity,
      0, -intensity, 0
    ]

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4

        for (let c = 0; c < 3; c++) { // RGB channels
          let sum = 0
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const kidx = ((y + ky) * width + (x + kx)) * 4 + c
              sum += data[kidx] * kernel[(ky + 1) * 3 + (kx + 1)]
            }
          }
          output[idx + c] = Math.max(0, Math.min(255, sum))
        }
      }
    }

    return new ImageData(output, width, height)
  }, [])

  // Procesamiento básico alternativo sin dependencias externas
  const processImageBasic = useCallback((imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(imageData)
            return
          }

          // Configurar canvas con proporción A4 aproximada
          const aspectRatio = 210 / 297 // A4 ratio
          let newWidth = img.width
          let newHeight = img.height

          // Ajustar tamaño manteniendo proporción
          if (newWidth / newHeight > aspectRatio) {
            newHeight = newWidth / aspectRatio
          } else {
            newWidth = newHeight * aspectRatio
          }

          canvas.width = newWidth
          canvas.height = newHeight

          // Dibujar imagen centrada
          const x = (newWidth - img.width) / 2
          const y = (newHeight - img.height) / 2
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, newWidth, newHeight)
          ctx.drawImage(img, x, y, img.width, img.height)

          // Aplicar filtro básico de contraste y brillo
          const processedImageData = ctx.getImageData(0, 0, newWidth, newHeight)
          const data = processedImageData.data

          for (let i = 0; i < data.length; i += 4) {
            // Aumentar contraste ligeramente
            data[i] = Math.min(255, data[i] * 1.1)     // Red
            data[i + 1] = Math.min(255, data[i + 1] * 1.1) // Green
            data[i + 2] = Math.min(255, data[i + 2] * 1.1) // Blue
          }

          ctx.putImageData(processedImageData, 0, 0)
          resolve(canvas.toDataURL('image/jpeg', 0.9))
        }
        img.onerror = () => resolve(imageData)
        img.src = imageData
      } catch (e) {
        console.warn('Error en procesamiento básico:', e)
        resolve(imageData)
      }
    })
  }, [])

  // 👁️ Vista previa del procesamiento
  const generatePreview = useCallback(async (imageData: string) => {
    if (!scannerReady || !scannerRef.current) {
      // Vista previa básica
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          // Agregar overlay de procesamiento básico
          ctx.fillStyle = 'rgba(34, 197, 94, 0.1)' // Verde claro
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 3
          ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
          setProcessingPreview(canvas.toDataURL('image/jpeg', 0.8))
        }
      }
      img.src = imageData
      return
    }

    try {
      // Vista previa con jscanify
      const cornerDetection = await detectDocumentCorners(imageData)
      if (cornerDetection) {
        setProcessingPreview(cornerDetection.highlightedImage)
        toast.info('Vista previa: Documento detectado con esquinas resaltadas')
      } else {
        // Vista previa básica si no hay detección
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)' // Azul claro
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            setProcessingPreview(canvas.toDataURL('image/jpeg', 0.8))
          }
        }
        img.src = imageData
      }
    } catch (e) {
      console.warn('Error generando vista previa:', e)
      setProcessingPreview(null)
    }
  }, [scannerReady, detectDocumentCorners])

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      context.drawImage(video, 0, 0)

      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.9)

      // Agregar captura original
      setCaptures(prev => [...prev, imageData])

      // Procesar imagen según disponibilidad
      let finalImage = imageData
      let stats = null
      setIsLoading(true)

      try {
        if (scannerReady && scannerRef.current) {
          // Generar información de detección primero
          const detectionInfo = await detectDocumentCorners(imageData)
          
          // Usar jscanify avanzado
          const result = await processImageWithJScanify(imageData, {
            autoCrop: true,
            enhance: true,
            quality: 0.95
          })
          finalImage = result.processedImage
          stats = {
            ...result.processingStats,
            detectionInfo: detectionInfo ? {
              cornersFound: detectionInfo.corners.length,
              method: detectionInfo.corners.length >= 4 ? 'jscanify + custom' : 'fallback detection',
              confidence: detectionInfo.corners.length >= 4 ? 85 : 60
            } : {
              cornersFound: 0,
              method: 'no detection',
              confidence: 0
            }
          }
          
          const detectionMessage = detectionInfo && detectionInfo.corners.length >= 4 
            ? `(${detectionInfo.corners.length} esquinas detectadas)` 
            : '(detección limitada)'
          
          toast.success(`Página procesada automáticamente ${detectionMessage} - ${stats.processingTime.toFixed(0)}ms`)
        } else {
          // Usar procesamiento básico como fallback
          finalImage = await processImageBasic(imageData)
          stats = {
            method: 'basic processing',
            quality: 0.9,
            dimensions: { width: video.videoWidth, height: video.videoHeight },
            processingTime: 50,
            detectionInfo: {
              cornersFound: 0,
              method: 'basic processing',
              confidence: 30
            }
          }
          toast.success('Página capturada (procesamiento básico aplicado)')
        }
      } catch (e) {
        console.warn('Error en procesamiento, usando imagen original:', e)
        stats = {
          method: 'original',
          quality: 0.9,
          dimensions: { width: video.videoWidth, height: video.videoHeight },
          processingTime: 0,
          detectionInfo: {
            cornersFound: 0,
            method: 'error fallback',
            confidence: 0
          }
        }
        toast.success('Página capturada (sin procesamiento adicional)')
      } finally {
        setIsLoading(false)
        setProcessingStats(stats)
        setProcessingPreview(null) // Limpiar preview después del procesamiento
      }

      setProcessedCaptures(prev => [...prev, finalImage])
    } catch (e) {
      console.error('Capture failed', e)
      toast.error('No se pudo capturar la imagen')
      setIsLoading(false)
    }
  }, [scannerReady, processImageWithJScanify, processImageBasic])

  const handleRemoveCapture = useCallback((idx: number) => {
    setCaptures(prev => prev.filter((_, i) => i !== idx))
    setProcessedCaptures(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleConfirm = useCallback(async () => {
    const sourceList = processedCaptures.length > 0 ? processedCaptures : captures
    if (sourceList.length === 0) {
      toast.error('No hay páginas capturadas')
      return
    }
    try {
      setIsLoading(true)
      const response = await fetch(sourceList[0])
      const blob = await response.blob()
      const file = makeFile(blob, `documento_escaneado_${Date.now()}.jpg`, 'image/jpeg')
      onConfirm(file)
      handleOpenChange(false)
      setCaptures([])
      setProcessedCaptures([])
      toast.success('Imagen agregada')
    } catch (e) {
      console.error('File creation failed', e)
      toast.error('Error al crear el archivo')
    } finally {
      setIsLoading(false)
    }
  }, [processedCaptures, captures, onConfirm, handleOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Cámara de documentos
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
              onClick={startCamera} 
              variant="outline" 
              size="sm"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Reintentar activar cámara
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          <div className="lg:col-span-2 space-y-2">
            <div className="relative border rounded overflow-hidden bg-black">
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
              <canvas ref={canvasRef} className="hidden" />
            </div>
                        <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleCapture}
                disabled={!!error || isLoading || !isCameraActive}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isLoading ? 'Procesando...' : scannerReady ? 'Capturar página (procesamiento automático)' : 'Capturar página (procesamiento básico)'}
              </Button>

              {/* Botón de vista previa */}
              {isCameraActive && !isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (videoRef.current && canvasRef.current) {
                      const video = videoRef.current
                      const canvas = canvasRef.current
                      const context = canvas.getContext('2d')
                      if (context) {
                        canvas.width = video.videoWidth
                        canvas.height = video.videoHeight
                        context.drawImage(video, 0, 0)
                        const imageData = canvas.toDataURL('image/jpeg', 0.8)
                        await generatePreview(imageData)
                        setShowPreview(true)
                      }
                    }
                  }}
                >
                  👁️ Vista previa
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setCaptures([])}
                disabled={captures.length === 0}
              >
                <X className="h-4 w-4 mr-2" /> Limpiar capturas
              </Button>
            </div>

            {/* Información de procesamiento */}
            {processingStats && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium text-gray-700 mb-2">📊 Información del procesamiento:</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>Método:</strong> {processingStats.method}</div>
                  <div><strong>Calidad:</strong> {(processingStats.quality * 100).toFixed(0)}%</div>
                  <div><strong>Dimensiones:</strong> {processingStats.dimensions.width}×{processingStats.dimensions.height}</div>
                  <div><strong>Tiempo:</strong> {processingStats.processingTime.toFixed(0)}ms</div>
                </div>
                {processingStats.detectionInfo && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <h6 className="text-xs font-medium text-gray-600 mb-1">🎯 Detección de esquinas:</h6>
                    <div className="text-xs text-gray-500">
                      <div><strong>Esquinas encontradas:</strong> {processingStats.detectionInfo.cornersFound}</div>
                      <div><strong>Método de detección:</strong> {processingStats.detectionInfo.method}</div>
                      <div><strong>Confianza:</strong> {processingStats.detectionInfo.confidence}%</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isCameraActive && !isLoading && !error && (
              <div className="text-center space-y-2">
                {isScannerLoading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Cargando herramientas de procesamiento...</span>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  {videoReady ? 'Iniciando cámara automáticamente...' : 'Preparando cámara...'}
                </p>
                {videoReady && (
                  <Button
                    type="button"
                    onClick={startCamera}
                    variant="outline"
                    size="sm"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Activar cámara manualmente
                  </Button>
                )}
              </div>
            )}

            {/* Indicador de procesamiento */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-medium">Procesando imagen...</span>
                </div>
              </div>
            )}

            {/* Estado del scanner */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                {scannerReady ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Procesamiento automático activado</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Procesamiento básico disponible</span>
                  </>
                )}
              </div>
              {captures.length > 0 && (
                <Badge variant="secondary">{captures.length} página{captures.length > 1 ? 's' : ''} capturada{captures.length > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Páginas capturadas ({captures.length})</h4>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-auto">
              {captures.map((capture, idx) => (
                <div key={idx} className="relative border rounded overflow-hidden">
                  <img src={capture} className="w-full h-28 object-cover" />
                  <div className="absolute top-1 left-1">
                    <Badge variant="secondary" className="text-[10px]">{idx + 1}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCapture(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal de vista previa de procesamiento */}
        {showPreview && processingPreview && (
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Vista previa del procesamiento
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Esta es una vista previa de cómo se verá tu imagen después del procesamiento automático.
                  {scannerReady ? ' Las esquinas del documento han sido detectadas y resaltadas.' : ' Se aplicará procesamiento básico de imagen.'}
                </div>

                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={processingPreview}
                    alt="Vista previa del procesamiento"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Cerrar vista previa
                  </Button>
                  <Button onClick={() => {
                    setShowPreview(false)
                    handleCapture()
                  }}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capturar con este procesamiento
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={handleConfirm} disabled={captures.length === 0 || !!error || isLoading}>
            <Camera className="h-4 w-4 mr-2" /> Confirmar captura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
