import { motion } from 'motion/react'
import type { Tool } from '../../../state/EditorContext'
import { Icon, type IconName } from '../../ui/Icon/Icon'
import styles from './ToolTabs.module.css'

const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: 'ai', label: 'ИИ', icon: 'sparkles' },
  { id: 'adjust', label: 'Настройки', icon: 'sliders' },
  { id: 'filters', label: 'Фильтры', icon: 'filters' },
  { id: 'crop', label: 'Кадр', icon: 'crop' },
]

interface ToolTabsProps {
  active: Tool
  onChange: (tool: Tool) => void
}

export function ToolTabs({ active, onChange }: ToolTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Инструменты">
      {TOOLS.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(t.id)}
            aria-pressed={isActive}
          >
            {isActive && <motion.span layoutId="tool-indicator" className={styles.indicator} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <Icon name={t.icon} size={22} />
            <span className={styles.label}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
