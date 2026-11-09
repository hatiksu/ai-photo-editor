import styles from './Slider.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  /** Вызывается, когда палец отпущен — сохраняем в историю */
  onCommit: () => void
  /** Двойное нажатие — сброс к нулю */
  onReset?: () => void
}

/** Крупный слайдер под палец. Для двусторонних шкал (−100…100) заливка идёт от центра. */
export function Slider({ label, value, min, max, onChange, onCommit, onReset }: SliderProps) {
  const bipolar = min < 0
  const pos = (value - min) / (max - min)
  const zero = bipolar ? (0 - min) / (max - min) : 0
  const from = Math.min(pos, zero)
  const to = Math.max(pos, zero)

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <button type="button" className={`${styles.value} tabular`} onClick={onReset} disabled={value === 0} title="Сбросить">
          {value > 0 && bipolar ? `+${value}` : value}
        </button>
      </div>
      <div className={styles.track} style={{ '--from': `${from * 100}%`, '--to': `${to * 100}%` } as React.CSSProperties}>
        {bipolar && <i className={styles.zero} />}
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={label}
          onChange={(e) => {
            const v = Number(e.target.value)
            // Лёгкое «прилипание» к нулю, чтобы было легко вернуться
            onChange(bipolar && Math.abs(v) <= 2 ? 0 : v)
          }}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onTouchEnd={onCommit}
          onDoubleClick={onReset}
        />
      </div>
    </div>
  )
}
