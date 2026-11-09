import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useLockBodyScroll } from '../../../hooks/useLockBodyScroll'
import { Icon } from '../Icon/Icon'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Нижняя шторка: свайп вниз за «ручку» закрывает, Esc тоже. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const drag = useDragControls()
  const panel = useRef<HTMLDivElement>(null)
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.root}>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className={styles.handleArea} onPointerDown={(e) => drag.start(e)}>
              <span className={styles.handle} />
            </div>
            <header className={styles.header}>
              <h2 className={styles.title}>{title}</h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
