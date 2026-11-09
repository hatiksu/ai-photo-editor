import { useCallback, useRef } from 'react'
import { animate, useMotionValue } from 'motion/react'

interface Options {
  enabled: boolean
  /** Долгое нажатие одним пальцем — показать оригинал */
  onHold: (holding: boolean) => void
  maxScale?: number
}

interface Pt {
  x: number
  y: number
}

const HOLD_MS = 280
const MOVE_TOLERANCE = 8
const DOUBLE_TAP_MS = 300

/**
 * Жесты на фото: щипок двумя пальцами — масштаб, перетаскивание — сдвиг (при увеличении),
 * двойной тап — увеличить/сбросить, колесо мыши — масштаб, долгое нажатие — сравнение с оригиналом.
 */
export function useGestures({ enabled, onHold, maxScale = 5 }: Options) {
  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const el = useRef<HTMLElement | null>(null)
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<{
    start: Pt
    t0: Pt
    s0: number
    dist0?: number
    mid0?: Pt
    moved: boolean
  } | null>(null)
  const holdTimer = useRef<number>(undefined)
  const holding = useRef(false)
  const lastTap = useRef<{ t: number; p: Pt } | null>(null)

  /** Координаты относительно центра контейнера */
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = el.current!.getBoundingClientRect()
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }
  }

  /** Не даём увести картинку за край */
  const clamp = (s: number, tx: number, ty: number): Pt => {
    const r = el.current!.getBoundingClientRect()
    const maxX = ((s - 1) * r.width) / 2
    const maxY = ((s - 1) * r.height) / 2
    return { x: Math.max(-maxX, Math.min(maxX, tx)), y: Math.max(-maxY, Math.min(maxY, ty)) }
  }

  const setTransform = (s: number, tx: number, ty: number, smooth = false) => {
    const next = clamp(s, tx, ty)
    if (smooth) {
      const opts = { type: 'spring' as const, stiffness: 400, damping: 40 }
      animate(scale, s, opts)
      animate(x, next.x, opts)
      animate(y, next.y, opts)
    } else {
      scale.set(s)
      x.set(next.x)
      y.set(next.y)
    }
  }

  /** Масштаб вокруг точки p: точка под пальцем остаётся на месте */
  const zoomAt = (p: Pt, s: number, smooth = false) => {
    const s0 = scale.get()
    const cx = (p.x - x.get()) / s0
    const cy = (p.y - y.get()) / s0
    setTransform(s, p.x - cx * s, p.y - cy * s, smooth)
  }

  const reset = useCallback(() => {
    const opts = { type: 'spring' as const, stiffness: 400, damping: 40 }
    animate(scale, 1, opts)
    animate(x, 0, opts)
    animate(y, 0, opts)
  }, [scale, x, y])

  const endHold = () => {
    window.clearTimeout(holdTimer.current)
    if (holding.current) {
      holding.current = false
      onHold(false)
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled) return
    el.current = e.currentTarget
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Некоторые браузеры не дают захватить указатель — жесты работают и без этого
    }
    const p = local(e)
    pointers.current.set(e.pointerId, p)

    if (pointers.current.size === 1) {
      gesture.current = { start: p, t0: { x: x.get(), y: y.get() }, s0: scale.get(), moved: false }
      holdTimer.current = window.setTimeout(() => {
        if (gesture.current && !gesture.current.moved && pointers.current.size === 1) {
          holding.current = true
          onHold(true)
          navigator.vibrate?.(8)
        }
      }, HOLD_MS)
    } else if (pointers.current.size === 2) {
      endHold()
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        start: p,
        t0: { x: x.get(), y: y.get() },
        s0: scale.get(),
        dist0: Math.hypot(a.x - b.x, a.y - b.y),
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        moved: true,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || !pointers.current.has(e.pointerId) || !gesture.current) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current

    if (pointers.current.size >= 2 && g.dist0 && g.mid0) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = Math.max(1, Math.min(maxScale, (g.s0 * dist) / g.dist0))
      // Точка контента под начальной серединой щипка остаётся под пальцами
      const cx = (g.mid0.x - g.t0.x) / g.s0
      const cy = (g.mid0.y - g.t0.y) / g.s0
      setTransform(s, mid.x - cx * s, mid.y - cy * s)
      return
    }

    const dx = p.x - g.start.x
    const dy = p.y - g.start.y
    if (!g.moved && Math.hypot(dx, dy) > MOVE_TOLERANCE) {
      g.moved = true
      window.clearTimeout(holdTimer.current)
    }
    if (g.moved && !holding.current && scale.get() > 1) setTransform(scale.get(), g.t0.x + dx, g.t0.y + dy)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = pointers.current.get(e.pointerId)!
    pointers.current.delete(e.pointerId)
    const wasTap = gesture.current && !gesture.current.moved && !holding.current
    endHold()

    if (pointers.current.size === 0) {
      gesture.current = null
      if (scale.get() < 1.02) reset()
      if (wasTap) {
        const now = performance.now()
        const prev = lastTap.current
        if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(prev.p.x - p.x, prev.p.y - p.y) < 30) {
          lastTap.current = null
          if (scale.get() > 1.05) reset()
          else zoomAt(p, 2.5, true)
        } else {
          lastTap.current = { t: now, p }
        }
      }
    } else if (pointers.current.size === 1) {
      // Остался один палец после щипка — продолжаем как сдвиг
      const [rest] = [...pointers.current.values()]
      gesture.current = { start: rest, t0: { x: x.get(), y: y.get() }, s0: scale.get(), moved: true }
    }
  }

  const onWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (!enabled) return
    el.current = e.currentTarget
    const s = Math.max(1, Math.min(maxScale, scale.get() * Math.exp(-e.deltaY * 0.0015)))
    zoomAt(local(e), s)
  }

  return {
    style: { scale, x, y },
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  }
}
