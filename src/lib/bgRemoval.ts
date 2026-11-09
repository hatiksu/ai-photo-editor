// Удаление фона нейросетью прямо на устройстве. Библиотека и модель грузятся только при первом вызове.
// Библиотека подключается с CDN (версия зафиксирована): она всё равно скачивает модель (~40 МБ) со своего сервера,
// а сборка в бандл добавила бы ещё 24 МБ WebAssembly. Из npm-пакета берём только типы.
import type * as BgRemoval from '@imgly/background-removal'
import { makeCanvas } from './image'

const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm'
let library: Promise<typeof BgRemoval> | null = null

export async function removeBackground(
  source: HTMLCanvasElement,
  onProgress?: (stage: 'download' | 'process', ratio: number) => void,
): Promise<HTMLCanvasElement> {
  library ??= import(/* @vite-ignore */ LIBRARY_URL) as Promise<typeof BgRemoval>
  let run: typeof BgRemoval.removeBackground
  try {
    ;({ removeBackground: run } = await library)
  } catch {
    library = null
    throw new Error('Нет соединения с интернетом — нейросеть загружается из сети')
  }
  const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Не удалось подготовить изображение')

  const result = await run(blob, {
    output: { format: 'image/png' },
    progress: (key, current, total) => onProgress?.(key.startsWith('fetch') ? 'download' : 'process', total ? current / total : 0),
  })

  const bitmap = await createImageBitmap(result)
  const out = makeCanvas(source.width, source.height)
  out.getContext('2d')!.drawImage(bitmap, 0, 0, out.width, out.height)
  bitmap.close()
  return out
}
