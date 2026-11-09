import { useCallback, useEffect, useRef } from 'react'
import type { Adjustments } from '../lib/processing'
import type { RenderRequest, RenderResponse } from '../workers/render.worker'

/**
 * Рендер предпросмотра в Web Worker по принципу «последний запрос побеждает»:
 * пока воркер считает кадр, новые запросы не копятся — берётся только самый свежий.
 */
export function useRenderer(onFrame: (image: ImageData) => void) {
  const worker = useRef<Worker | null>(null)
  const busy = useRef(false)
  const pending = useRef<{ adj: Adjustments; source?: ImageData } | null>(null)
  const nextId = useRef(0)
  const frameCb = useRef(onFrame)

  useEffect(() => {
    frameCb.current = onFrame
  }, [onFrame])

  const flush = useCallback(() => {
    const w = worker.current
    const job = pending.current
    if (!w || !job || busy.current) return
    pending.current = null
    busy.current = true
    const msg: RenderRequest = { id: ++nextId.current, adj: job.adj, source: job.source }
    w.postMessage(msg)
  }, [])

  useEffect(() => {
    const w = new Worker(new URL('../workers/render.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<RenderResponse>) => {
      busy.current = false
      frameCb.current(e.data.image)
      flush()
    }
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [flush])

  /** Запросить кадр. source передаётся, только когда сменилось изображение. */
  const render = useCallback(
    (adj: Adjustments, source?: ImageData) => {
      // Если в очереди уже был новый исходник — не теряем его
      const keepSource = source ?? pending.current?.source
      pending.current = { adj, source: keepSource }
      flush()
    },
    [flush],
  )

  return render
}
