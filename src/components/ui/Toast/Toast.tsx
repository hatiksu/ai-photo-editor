import { AnimatePresence, motion } from 'motion/react'
import styles from './Toast.module.css'

export interface ToastOptions {
  action?: { label: string; onClick: () => void }
  tone?: 'default' | 'error'
}

export interface ToastItem extends ToastOptions {
  id: number
  message: string
}

interface ToastProps {
  toast: ToastItem | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`${styles.toast} ${toast.tone === 'error' ? styles.error : ''}`}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
          >
            <span className={styles.message}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  onDismiss()
                }}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
