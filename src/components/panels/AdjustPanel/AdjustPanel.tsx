import { useState } from 'react'
import { SLIDERS, defaultAdjustments, type AdjKey } from '../../../lib/processing'
import { useEditor } from '../../../state/EditorContext'
import { Chip } from '../../ui/Chip/Chip'
import { Slider } from '../../ui/Slider/Slider'
import ui from '../panel.module.css'

/** Ручные настройки: выбираешь параметр в ленте — двигаешь один крупный ползунок. */
export function AdjustPanel() {
  const { view, dispatch } = useEditor()
  const [active, setActive] = useState<AdjKey>('exposure')
  const def = SLIDERS.find((s) => s.key === active)!
  const changed = SLIDERS.some((s) => view.adj[s.key] !== 0)

  const set = (value: number) => dispatch({ type: 'draft', adj: { ...view.adj, [active]: value } })
  const resetOne = () => dispatch({ type: 'commit', adj: { ...view.adj, [active]: 0 } })

  return (
    <div className={ui.panel}>
      <Slider
        label={`${def.icon} ${def.label}`}
        value={view.adj[active]}
        min={def.min}
        max={def.max}
        onChange={set}
        onCommit={() => dispatch({ type: 'commit' })}
        onReset={resetOne}
      />
      <div className={ui.scroller}>
        {SLIDERS.map((s) => (
          <Chip key={s.key} active={s.key === active} onClick={() => setActive(s.key)} dot={view.adj[s.key] !== 0}>
            <span aria-hidden="true">{s.icon}</span>
            {s.label}
          </Chip>
        ))}
      </div>
      <div className={ui.row}>
        <p className={ui.hint}>Удерживайте фото, чтобы сравнить с оригиналом</p>
        <span className={ui.spacer} />
        <button
          type="button"
          className={ui.textButton}
          disabled={!changed}
          onClick={() => dispatch({ type: 'commit', adj: defaultAdjustments(), preset: 'Оригинал' })}
        >
          Сбросить всё
        </button>
      </div>
    </div>
  )
}
