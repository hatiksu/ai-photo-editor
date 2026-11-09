import { useState } from 'react'
import { canvasToBlob, EXTENSIONS, type ExportFormat } from '../../../lib/image'
import type { Adjustments } from '../../../lib/processing'
import { renderFull } from '../../../lib/renderFull'
import { Icon } from '../../ui/Icon/Icon'
import { Sheet } from '../../ui/Sheet/Sheet'
import ui from '../../panels/panel.module.css'
import styles from './ExportSheet.module.css'

interface ExportSheetProps {
  open: boolean
  onClose: () => void
  base: HTMLCanvasElement
  adj: Adjustments
  fileName: string
  hasTransparency: boolean
  setBusy: (text: string | null) => void
  toast: (message: string, options?: { tone?: 'default' | 'error' }) => void
}

const FORMATS: { value: ExportFormat; label: string; note: string }[] = [
  { value: 'image/jpeg', label: 'JPEG', note: 'Меньше размер' },
  { value: 'image/png', label: 'PNG', note: 'Без потерь, с прозрачностью' },
  { value: 'image/webp', label: 'WebP', note: 'Современный, компактный' },
]

const canShareFiles = () => typeof navigator.canShare === 'function'

export function ExportSheet({ open, onClose, base, adj, fileName, hasTransparency, setBusy, toast }: ExportSheetProps) {
  const [format, setFormat] = useState<ExportFormat>(hasTransparency ? 'image/png' : 'image/jpeg')
  const [quality, setQuality] = useState(92)

  const produce = async () => {
    setBusy('Готовлю файл…')
    try {
      const full = await renderFull(base, adj)
      const blob = await canvasToBlob(full, format, quality / 100)
      return new File([blob], `${fileName}-edited.${EXTENSIONS[format]}`, { type: format })
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    try {
      const file = await produce()
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      onClose()
      toast('Фото сохранено')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось сохранить', { tone: 'error' })
    }
  }

  const share = async () => {
    try {
      const file = await produce()
      if (!navigator.canShare?.({ files: [file] })) throw new Error('Это устройство не умеет делиться файлами')
      await navigator.share({ files: [file], title: 'Фото' })
      onClose()
    } catch (err) {
      // Пользователь закрыл системное меню — это не ошибка
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast(err instanceof Error ? err.message : 'Не удалось поделиться', { tone: 'error' })
    }
  }

  return (
    <Sheet open={open} title="Сохранить фото" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.formats} role="radiogroup" aria-label="Формат">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={format === f.value}
              className={`${styles.format} ${format === f.value ? styles.active : ''}`}
              onClick={() => setFormat(f.value)}
            >
              <strong>{f.label}</strong>
              <small>{f.note}</small>
            </button>
          ))}
        </div>

        {format === 'image/jpeg' && hasTransparency && <p className={ui.hint}>В JPEG нет прозрачности — фон станет белым. Для прозрачного фона выберите PNG.</p>}

        {format !== 'image/png' && (
          <label className={styles.quality}>
            <span>
              Качество <b className="tabular">{quality}%</b>
            </span>
            <input type="range" min={50} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </label>
        )}

        <p className={`${ui.hint} tabular`}>
          Размер: {base.width} × {base.height} px — в полном разрешении
        </p>

        <div className={ui.row}>
          {canShareFiles() && (
            <button type="button" className={ui.secondary} onClick={share}>
              <Icon name="share" size={18} /> Поделиться
            </button>
          )}
          <button type="button" className={ui.primary} onClick={download}>
            <Icon name="download" size={18} /> Скачать
          </button>
        </div>
      </div>
    </Sheet>
  )
}
