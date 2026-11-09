import { useRef } from 'react'
import type { CropRect } from '../../../lib/image'
import styles from './CropOverlay.module.css'

interface CropOverlayProps {
  rect: CropRect
  /** Соотношение сторон в пикселях (w/h) или null */
  aspect: number | null
  /** Соотношение сторон изображения в пикселях */
  imageAspect: number
  onChange: (rect: CropRect) => void
}

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'
const MIN = 0.06

/** Рамка обрезки: тянуть за середину — двигать, за углы — менять размер. Работает пальцем и мышью. */
export function CropOverlay({ rect, aspect, imageAspect, onChange }: CropOverlayProps) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; sx: number; sy: number; start: CropRect } | null>(null)
  // Пропорция в долях от размеров изображения
  const aspectNorm = aspect ? aspect / imageAspect : null

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      root.current?.setPointerCapture(e.pointerId)
    } catch {
      // Без захвата рамка всё равно двигается, пока палец над ней
    }
    drag.current = { handle, sx: e.clientX, sy: e.clientY, start: { ...rect } }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !root.current) return
    const r = root.current.getBoundingClientRect()
    const dx = (e.clientX - d.sx) / r.width
    const dy = (e.clientY - d.sy) / r.height
    const s = d.start
    let { x, y, w, h } = s

    if (d.handle === 'move') {
      x = Math.min(1 - w, Math.max(0, s.x + dx))
      y = Math.min(1 - h, Math.max(0, s.y + dy))
    } else {
      const west = d.handle.includes('w')
      const north = d.handle.includes('n')
      const right = s.x + s.w
      const bottom = s.y + s.h
      w = west ? Math.min(right, Math.max(MIN, s.w - dx)) : Math.min(1 - s.x, Math.max(MIN, s.w + dx))
      h = north ? Math.min(bottom, Math.max(MIN, s.h - dy)) : Math.min(1 - s.y, Math.max(MIN, s.h + dy))
      if (aspectNorm) {
        // Держим пропорцию и не выходим за границы
        const maxW = west ? right : 1 - s.x
        const maxH = north ? bottom : 1 - s.y
        if (w / h > aspectNorm) w = h * aspectNorm
        else h = w / aspectNorm
        if (w > maxW) {
          w = maxW
          h = w / aspectNorm
        }
        if (h > maxH) {
          h = maxH
          w = h * aspectNorm
        }
      }
      x = west ? right - w : s.x
      y = north ? bottom - h : s.y
    }
    onChange({ x, y, w, h })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const pct = (v: number) => `${v * 100}%`

  return (
    <div ref={root} className={styles.overlay} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div
        className={styles.rect}
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        onPointerDown={onPointerDown('move')}
        role="group"
        aria-label="Рамка обрезки"
      >
        <i className={styles.grid} />
        {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
          <span key={h} className={`${styles.handle} ${styles[h]}`} onPointerDown={onPointerDown(h)} />
        ))}
      </div>
    </div>
  )
}
