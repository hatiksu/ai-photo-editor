import type { ReactNode } from 'react'
import styles from './Chip.module.css'

interface ChipProps {
  active?: boolean
  onClick: () => void
  children: ReactNode
  /** Маленькая точка — параметр изменён */
  dot?: boolean
  label?: string
}

export function Chip({ active, onClick, children, dot, label }: ChipProps) {
  return (
    <button type="button" className={`${styles.chip} ${active ? styles.active : ''}`} onClick={onClick} aria-pressed={active} aria-label={label}>
      {children}
      {dot && <i className={styles.dot} />}
    </button>
  )
}
