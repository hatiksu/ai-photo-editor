import { createContext, useContext, type Dispatch, type RefObject } from 'react'
import type { ToastOptions } from '../components/ui/Toast/Toast'
import type { CropRect } from '../lib/image'
import type { Adjustments } from '../lib/processing'
import type { EditorAction, EditorState } from './editor'

export type Tool = 'adjust' | 'filters' | 'crop' | 'ai'

export interface CropState {
  rect: CropRect
  /** Соотношение сторон (ширина/высота в пикселях) или null — свободно */
  aspect: number | null
}

export interface EditorContextValue {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  view: { base: HTMLCanvasElement; adj: Adjustments; preset: string | null }
  /** Уменьшенная копия текущего изображения — для автоулучшения и превью фильтров */
  preview: ImageData
  tool: Tool
  crop: CropState
  setCrop: (crop: CropState) => void
  toast: (message: string, options?: ToastOptions) => void
  /** Показать оверлей занятости (null — скрыть) */
  setBusy: (text: string | null) => void
  apiKey: string
  openApiKey: () => void
  /** Канвас предпросмотра (с применёнными правками) — его видит Claude */
  previewCanvas: RefObject<HTMLCanvasElement | null>
  /** Результат удаления фона: вырезанный объект и снимок до удаления — чтобы менять фон */
  cutout: { cutout: HTMLCanvasElement; source: HTMLCanvasElement } | null
  setCutout: (value: { cutout: HTMLCanvasElement; source: HTMLCanvasElement } | null) => void
}

export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor вызван вне EditorContext')
  return ctx
}
