// Обработка пикселей в отдельном потоке: ползунки двигаются плавно, интерфейс не подвисает.
import { applyAdjustments, type Adjustments } from '../lib/processing'

export interface RenderRequest {
  id: number
  /** Новый исходник (присылается только когда меняется изображение) */
  source?: ImageData
  adj: Adjustments
}

export interface RenderResponse {
  id: number
  image: ImageData
}

let source: ImageData | null = null

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const { id, adj } = e.data
  if (e.data.source) source = e.data.source
  if (!source) return
  const image = applyAdjustments(source, adj)
  ;(self as unknown as Worker).postMessage({ id, image } satisfies RenderResponse, [image.data.buffer])
}
