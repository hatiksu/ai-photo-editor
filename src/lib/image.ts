// Работа с изображениями в браузере: загрузка, масштаб, повороты, обрезка, фон, экспорт.

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Самая длинная сторона, до которой уменьшаем очень большие фото, чтобы не упереться в память телефона. */
const MAX_SIDE = 4096

/** Загружает файл в холст с учётом EXIF-ориентации. */
export async function loadImageFile(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const c = makeCanvas(bitmap.width * scale, bitmap.height * scale)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, c.width, c.height)
  bitmap.close()
  return c
}

/** Уменьшенная копия для предпросмотра. */
export function scaledImageData(src: CanvasImageSource & { width: number; height: number }, maxSide: number): ImageData {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height))
  const c = makeCanvas(src.width * s, src.height * s)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return ctx.getImageData(0, 0, c.width, c.height)
}

export function imageDataOf(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
}

export type TransformKind = 'rotateLeft' | 'rotateRight' | 'flipH' | 'flipV'

export function transformCanvas(src: HTMLCanvasElement, kind: TransformKind): HTMLCanvasElement {
  const rotate = kind === 'rotateLeft' || kind === 'rotateRight'
  const c = makeCanvas(rotate ? src.height : src.width, rotate ? src.width : src.height)
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2)
  if (kind === 'rotateLeft') ctx.rotate(-Math.PI / 2)
  if (kind === 'rotateRight') ctx.rotate(Math.PI / 2)
  if (kind === 'flipH') ctx.scale(-1, 1)
  if (kind === 'flipV') ctx.scale(1, -1)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return c
}

/** Прямоугольник обрезки в долях от размеров изображения (0–1). */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export const FULL_RECT: CropRect = { x: 0, y: 0, w: 1, h: 1 }

/** Самая большая рамка нужной пропорции по центру */
export function fitRect(aspect: number | null, imageAspect: number): CropRect {
  if (!aspect) return { ...FULL_RECT }
  const a = aspect / imageAspect
  let w = 1
  let h = w / a
  if (h > 1) {
    h = 1
    w = h * a
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

export function cropCanvas(src: HTMLCanvasElement, r: CropRect): HTMLCanvasElement {
  const sx = Math.round(r.x * src.width)
  const sy = Math.round(r.y * src.height)
  const sw = Math.max(1, Math.round(r.w * src.width))
  const sh = Math.max(1, Math.round(r.h * src.height))
  const c = makeCanvas(sw, sh)
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  return c
}

export type Backdrop = { kind: 'transparent' } | { kind: 'color'; color: string } | { kind: 'blur' }

/** Подкладывает новый фон под вырезанный объект. */
export function composeBackground(cutout: HTMLCanvasElement, original: HTMLCanvasElement, backdrop: Backdrop): HTMLCanvasElement {
  const { width: w, height: h } = cutout
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')!
  if (backdrop.kind === 'color') {
    ctx.fillStyle = backdrop.color
    ctx.fillRect(0, 0, w, h)
  } else if (backdrop.kind === 'blur') {
    // Размываем уменьшенную копию — быстро на любом размере
    const small = makeCanvas(w / 8, h / 8)
    const sctx = small.getContext('2d')!
    sctx.filter = 'blur(3px)'
    sctx.drawImage(original, 0, 0, small.width, small.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(small, 0, 0, w, h)
  }
  ctx.drawImage(cutout, 0, 0)
  return c
}

export type ExportFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export const EXTENSIONS: Record<ExportFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type: ExportFormat, quality: number): Promise<Blob> {
  let out = canvas
  if (type === 'image/jpeg') {
    // У JPEG нет прозрачности — подкладываем белый
    out = makeCanvas(canvas.width, canvas.height)
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, quality))
  if (!blob) throw new Error('Браузер не смог сохранить изображение')
  return blob
}

/** Уменьшенная JPEG-копия в base64 (без префикса) — для отправки в Claude. */
export function canvasToBase64(canvas: HTMLCanvasElement, maxSide = 1024): string {
  const s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  const c = makeCanvas(canvas.width * s, canvas.height * s)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(canvas, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85).split(',')[1]
}

/** Сгенерированное фото-пример (закат над горами) — чтобы попробовать редактор без своего снимка. */
export function generateSample(): HTMLCanvasElement {
  const w = 1600
  const h = 1200
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')!

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7)
  sky.addColorStop(0, '#2b3a67')
  sky.addColorStop(0.55, '#c26a5a')
  sky.addColorStop(1, '#f2b36b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const sun = ctx.createRadialGradient(w * 0.62, h * 0.55, 10, w * 0.62, h * 0.55, 220)
  sun.addColorStop(0, 'rgba(255,240,200,1)')
  sun.addColorStop(0.25, 'rgba(255,210,140,0.9)')
  sun.addColorStop(1, 'rgba(255,180,120,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h)

  const ridge = (y: number, amp: number, color: string, seed: number) => {
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 20) {
      const v = Math.sin(x / 180 + seed) * amp + Math.sin(x / 63 + seed * 2) * amp * 0.35
      ctx.lineTo(x, y + v)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  ridge(h * 0.62, 60, '#6a4a6e', 1)
  ridge(h * 0.7, 70, '#3f3557', 2.4)
  ridge(h * 0.8, 50, '#241f38', 4.1)

  // Лёгкий шум, чтобы снимок выглядел «живым»
  const img = ctx.getImageData(0, 0, w, h)
  let seed = 7
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const n = ((seed / 0x7fffffff) - 0.5) * 10
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  return c
}
