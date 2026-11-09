// Полноразмерный рендер для сохранения — в отдельном воркере, чтобы интерфейс не замирал.
import type { Adjustments } from './processing'
import type { RenderResponse } from '../workers/render.worker'
import { imageDataOf, makeCanvas } from './image'

export function renderFull(base: HTMLCanvasElement, adj: Adjustments): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<RenderResponse>) => {
      const out = makeCanvas(e.data.image.width, e.data.image.height)
      out.getContext('2d')!.putImageData(e.data.image, 0, 0)
      worker.terminate()
      resolve(out)
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Ошибка обработки'))
    }
    worker.postMessage({ id: 1, source: imageDataOf(base), adj })
  })
}
