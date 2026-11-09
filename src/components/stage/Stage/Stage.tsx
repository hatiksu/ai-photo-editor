import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGestures } from '../../../hooks/useGestures'
import type { CropState } from '../../../state/EditorContext'
import { CropOverlay } from '../CropOverlay/CropOverlay'
import styles from './Stage.module.css'

interface StageProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Размеры текущего изображения — для пропорций рамки */
  imageWidth: number
  imageHeight: number
  original: ImageData | null
  cropping: boolean
  crop: CropState
  onCropChange: (crop: CropState) => void
}

/** Сцена с фото: вписывается в экран, поддерживает жесты и рамку обрезки. */
export function Stage({ canvasRef, imageWidth, imageHeight, original, cropping, crop, onCropChange }: StageProps) {
  const container = useRef<HTMLDivElement>(null)
  const originalCanvas = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [comparing, setComparing] = useState(false)
  const gestures = useGestures({ enabled: !cropping, onHold: setComparing })
  const resetZoom = gestures.reset

  // Размер области, в которую вписываем фото
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // При обрезке масштаб должен быть 1, иначе рамка не совпадёт с фото
  useEffect(() => {
    if (cropping) resetZoom()
  }, [cropping, resetZoom])

  useEffect(() => {
    if (!original || !originalCanvas.current) return
    const c = originalCanvas.current
    c.width = original.width
    c.height = original.height
    c.getContext('2d')!.putImageData(original, 0, 0)
  }, [original])

  const aspect = imageWidth / imageHeight
  const fitW = box.w && box.h ? Math.min(box.w, box.h * aspect) : 0
  const fitH = fitW / aspect

  return (
    <div ref={container} className={styles.stage} {...gestures.handlers}>
      <motion.div className={styles.frame} style={{ width: fitW, height: fitH, ...gestures.style }}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label="Редактируемое фото" />
        <canvas ref={originalCanvas} className={`${styles.canvas} ${styles.original}`} style={{ opacity: comparing ? 1 : 0 }} aria-hidden="true" />
        {cropping && (
          <CropOverlay rect={crop.rect} aspect={crop.aspect} imageAspect={aspect} onChange={(rect) => onCropChange({ ...crop, rect })} />
        )}
      </motion.div>

      <AnimatePresence>
        {comparing && (
          <motion.span className={styles.badge} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            Оригинал
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
