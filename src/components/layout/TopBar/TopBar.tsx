import { motion } from 'motion/react'
import { Icon } from '../../ui/Icon/Icon'
import styles from './TopBar.module.css'

interface TopBarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClose: () => void
  onExport: () => void
}

export function TopBar({ canUndo, canRedo, onUndo, onRedo, onClose, onExport }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <button type="button" className={styles.icon} onClick={onClose} aria-label="Закрыть фото">
        <Icon name="close" />
      </button>
      <div className={styles.history}>
        <button type="button" className={styles.icon} onClick={onUndo} disabled={!canUndo} aria-label="Отменить">
          <Icon name="undo" />
        </button>
        <button type="button" className={styles.icon} onClick={onRedo} disabled={!canRedo} aria-label="Повторить">
          <Icon name="redo" />
        </button>
      </div>
      <motion.button type="button" className={styles.export} onClick={onExport} whileTap={{ scale: 0.95 }}>
        <Icon name="download" size={18} /> Сохранить
      </motion.button>
    </header>
  )
}
