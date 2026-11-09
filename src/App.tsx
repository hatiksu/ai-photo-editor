import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ApiKeySheet } from './components/export/ApiKeySheet/ApiKeySheet'
import { ExportSheet } from './components/export/ExportSheet/ExportSheet'
import { TopBar } from './components/layout/TopBar/TopBar'
import { ToolTabs } from './components/layout/ToolTabs/ToolTabs'
import { Welcome } from './components/layout/Welcome/Welcome'
import { AdjustPanel } from './components/panels/AdjustPanel/AdjustPanel'
import { AIPanel } from './components/panels/AIPanel/AIPanel'
import { CropPanel } from './components/panels/CropPanel/CropPanel'
import { FiltersPanel } from './components/panels/FiltersPanel/FiltersPanel'
import { Stage } from './components/stage/Stage/Stage'
import { Toast, type ToastItem, type ToastOptions } from './components/ui/Toast/Toast'
import { useRenderer } from './hooks/useRenderer'
import { FULL_RECT, generateSample, loadImageFile, scaledImageData } from './lib/image'
import { API_KEY_STORAGE, storage } from './lib/storage'
import { currentView, editorReducer, initialState } from './state/editor'
import { EditorContext, type CropState, type EditorContextValue, type Tool } from './state/EditorContext'
import styles from './App.module.css'

/** Размер предпросмотра: на телефоне меньше — быстрее отклик ползунков */
const PREVIEW_MAX = matchMedia('(pointer: coarse)').matches ? 1280 : 1800

const PANELS: Record<Tool, () => React.JSX.Element> = {
  adjust: AdjustPanel,
  filters: FiltersPanel,
  crop: CropPanel,
  ai: AIPanel,
}

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialState)
  const view = currentView(state)
  const [tool, setTool] = useState<Tool>('ai')
  const [crop, setCrop] = useState<CropState>({ aspect: null, rect: { ...FULL_RECT } })
  const [busy, setBusy] = useState<string | null>(null)
  const [toastItem, setToastItem] = useState<ToastItem | null>(null)
  const [apiKey, setApiKey] = useState(() => storage.get(API_KEY_STORAGE) ?? '')
  const [keyOpen, setKeyOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportKey, setExportKey] = useState(0)
  const [cutout, setCutout] = useState<EditorContextValue['cutout']>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toastTimer = useRef<number>(undefined)

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    window.clearTimeout(toastTimer.current)
    setToastItem({ id: Date.now(), message, ...options })
    toastTimer.current = window.setTimeout(() => setToastItem(null), options.tone === 'error' ? 6000 : 3000)
  }, [])

  // ---------- Предпросмотр ----------

  const base = view?.base ?? null
  const preview = useMemo(() => (base ? scaledImageData(base, PREVIEW_MAX) : null), [base])
  const originalPreview = useMemo(() => (state.original ? scaledImageData(state.original, PREVIEW_MAX) : null), [state.original])

  const drawFrame = useCallback((image: ImageData) => {
    const c = canvasRef.current
    if (!c) return
    if (c.width !== image.width || c.height !== image.height) {
      c.width = image.width
      c.height = image.height
    }
    c.getContext('2d')!.putImageData(image, 0, 0)
  }, [])

  const render = useRenderer(drawFrame)
  const sentSource = useRef<ImageData | null>(null)
  const adj = view?.adj

  useEffect(() => {
    if (!preview || !adj) return
    const isNew = sentSource.current !== preview
    sentSource.current = preview
    render(adj, isNew ? preview : undefined)
  }, [preview, adj, render])

  // ---------- Загрузка ----------

  const loadCanvas = useCallback((canvas: HTMLCanvasElement, fileName: string) => {
    setCutout(null)
    setCrop({ aspect: null, rect: { ...FULL_RECT } })
    setTool('ai')
    dispatch({ type: 'load', canvas, fileName })
  }, [])

  const openFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast('Это не изображение', { tone: 'error' })
        return
      }
      setBusy('Открываю фото…')
      try {
        loadCanvas(await loadImageFile(file), file.name.replace(/\.[^.]+$/, '') || 'photo')
      } catch (err) {
        console.error(err)
        toast('Не удалось открыть фото. Попробуйте JPEG или PNG', { tone: 'error' })
      } finally {
        setBusy(null)
      }
    },
    [loadCanvas, toast],
  )

  // Вставка из буфера обмена
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) openFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [openFile])

  // Горячие клавиши на компьютере
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).matches('input, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'undo' })
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- PWA ----------

  const updateRef = useRef<(reload?: boolean) => Promise<void>>(undefined)
  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh: () => toast('Доступна новая версия', { action: { label: 'Обновить', onClick: () => updateRef.current?.(true) } }),
    onOfflineReady: () => toast('Редактор готов к работе без интернета'),
  })
  useEffect(() => {
    updateRef.current = updateServiceWorker
  }, [updateServiceWorker])

  // ---------- Прочее ----------

  const changeTool = (next: Tool) => {
    if (next === 'crop' && tool !== 'crop') setCrop({ aspect: null, rect: { ...FULL_RECT } })
    setTool(next)
  }

  const saveKey = (key: string) => {
    storage.set(API_KEY_STORAGE, key)
    setApiKey(key)
    setKeyOpen(false)
    toast(key ? 'Ключ сохранён на этом устройстве' : 'Ключ удалён')
  }

  const close = () => {
    if (state.index > 0 && !confirm('Закрыть фото? Несохранённые правки пропадут.')) return
    setCutout(null)
    dispatch({ type: 'close' })
  }

  const ctx = useMemo<EditorContextValue | null>(
    () =>
      view && preview
        ? {
            state,
            dispatch,
            view,
            preview,
            tool,
            crop,
            setCrop,
            toast,
            setBusy,
            apiKey,
            openApiKey: () => setKeyOpen(true),
            previewCanvas: canvasRef,
            cutout,
            setCutout,
          }
        : null,
    [state, view, preview, tool, crop, toast, apiKey, cutout],
  )

  const Panel = PANELS[tool]

  return (
    <MotionConfig reducedMotion="user">
      {!ctx || !view ? (
        <Welcome onFile={openFile} onSample={() => loadCanvas(generateSample(), 'sample')} />
      ) : (
        <EditorContext.Provider value={ctx}>
          <div className={styles.editor}>
            <TopBar
              canUndo={state.index > 0}
              canRedo={state.index < state.history.length - 1}
              onUndo={() => dispatch({ type: 'undo' })}
              onRedo={() => dispatch({ type: 'redo' })}
              onClose={close}
              onExport={() => {
                setExportKey((k) => k + 1)
                setExportOpen(true)
              }}
            />
            <Stage
              canvasRef={canvasRef}
              imageWidth={view.base.width}
              imageHeight={view.base.height}
              original={originalPreview}
              cropping={tool === 'crop'}
              crop={crop}
              onCropChange={setCrop}
            />
            <section className={styles.panel} aria-label="Панель инструмента">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tool} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <Panel />
                </motion.div>
              </AnimatePresence>
            </section>
            <ToolTabs active={tool} onChange={changeTool} />
          </div>

          <ExportSheet
            key={exportKey}
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            base={view.base}
            adj={view.adj}
            fileName={state.fileName}
            hasTransparency={Boolean(cutout && view.base === cutout.cutout)}
            setBusy={setBusy}
            toast={toast}
          />
        </EditorContext.Provider>
      )}

      <ApiKeySheet key={String(keyOpen)} open={keyOpen} value={apiKey} onClose={() => setKeyOpen(false)} onSave={saveKey} />

      <AnimatePresence>
        {busy && (
          <motion.div className={styles.busy} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" aria-live="assertive">
            <span className={styles.spinner} />
            <span>{busy}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toastItem} onDismiss={() => setToastItem(null)} />
    </MotionConfig>
  )
}
