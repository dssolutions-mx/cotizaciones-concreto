'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  onChange: (hasStroke: boolean) => void
  /** Ref to read PNG blob via `exportPngBlob()` */
  exportRef: React.MutableRefObject<(() => Promise<Blob | null>) | null>
}

function getPoint(
  e: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

export default function SignaturePad({ className, onChange, exportRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  const syncHasStroke = useCallback(
    (value: boolean) => {
      hasStrokeRef.current = value
      setHasStroke(value)
      onChange(value)
    },
    [onChange],
  )

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    syncHasStroke(false)
  }, [syncHasStroke])

  const exportPngBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokeRef.current) return null
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }, [])

  useEffect(() => {
    exportRef.current = exportPngBlob
    return () => {
      exportRef.current = null
    }
  }, [exportPngBlob, exportRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const width = Math.floor(parent.clientWidth)
      const height = Math.floor(parent.clientHeight)
      if (width <= 0 || height <= 0) return

      const hadStroke = hasStrokeRef.current
      const snapshot = hadStroke ? canvas.toDataURL('image/png') : null

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#1B2A4A'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (snapshot) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height)
        }
        img.src = snapshot
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement!)
    return () => observer.disconnect()
  }, [])

  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawingRef.current = true
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = getPoint(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function continueStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getPoint(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasStrokeRef.current) syncHasStroke(true)
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      // ignore if capture was already released
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative h-36 w-full max-w-md rounded-xl border-2 border-dashed border-stone-300 bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair"
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        />
        {!hasStroke && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">
            Dibuja tu firma aquí
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={clear}
        disabled={!hasStroke}
      >
        <Eraser className="h-3.5 w-3.5" />
        Borrar firma
      </Button>
    </div>
  )
}
