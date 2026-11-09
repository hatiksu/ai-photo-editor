import { useEffect, useRef, useState } from 'react'
import { makeCanvas } from '../../../lib/image'
import { PRESETS, applyAdjustments, type Adjustments, type Preset } from '../../../lib/processing'
import { useEditor } from '../../../state/EditorContext'
import { Slider } from '../../ui/Slider/Slider'
import ui from '../panel.module.css'
import styles from './FiltersPanel.module.css'

const THUMB = 96

/** Смешивает фильтр с исходником: 0 — без фильтра, 100 — полная сила */
function blend(preset: Preset, strength: number): Adjustments {
  return Object.fromEntries(Object.entries(preset.adj).map(([k, v]) => [k, Math.round(v * (strength / 100))])) as Adjustments
}

/** Квадратная миниатюра из центра изображения */
function thumbSource(preview: ImageData): ImageData {
  const src = makeCanvas(preview.width, preview.height)
  src.getContext('2d')!.putImageData(preview, 0, 0)
  const side = Math.min(preview.width, preview.height)
  const c = makeCanvas(THUMB, THUMB)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, (preview.width - side) / 2, (preview.height - side) / 2, side, side, 0, 0, THUMB, THUMB)
  return ctx.getImageData(0, 0, THUMB, THUMB)
}

export function FiltersPanel() {
  const { view, preview, dispatch } = useEditor()
  const [strength, setStrength] = useState(100)
  const refs = useRef(new Map<string, HTMLCanvasElement>())
  const selected = PRESETS.find((p) => p.name === view.preset) ?? null

  // Миниатюры перерисовываются, только когда меняется само изображение
  useEffect(() => {
    const src = thumbSource(preview)
    for (const p of PRESETS) {
      refs.current.get(p.name)?.getContext('2d')?.putImageData(applyAdjustments(src, p.adj), 0, 0)
    }
  }, [preview])

  const choose = (p: Preset) => {
    setStrength(100)
    dispatch({ type: 'commit', adj: { ...p.adj }, preset: p.name })
  }

  return (
    <div className={ui.panel}>
      {selected && selected.name !== 'Оригинал' ? (
        <Slider
          label={`Сила фильтра «${selected.name}»`}
          value={strength}
          min={0}
          max={100}
          onChange={(v) => {
            setStrength(v)
            dispatch({ type: 'draft', adj: blend(selected, v) })
          }}
          onCommit={() => dispatch({ type: 'commit', adj: blend(selected, strength), preset: selected.name })}
          onReset={() => {
            setStrength(100)
            dispatch({ type: 'commit', adj: { ...selected.adj }, preset: selected.name })
          }}
        />
      ) : (
        <p className={ui.hint}>Выберите фильтр — потом можно настроить его силу</p>
      )}
      <div className={ui.scroller}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className={`${styles.preset} ${view.preset === p.name ? styles.active : ''}`}
            onClick={() => choose(p)}
            aria-pressed={view.preset === p.name}
          >
            <canvas
              ref={(el) => {
                if (el) refs.current.set(p.name, el)
              }}
              width={THUMB}
              height={THUMB}
              className={styles.thumb}
            />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
