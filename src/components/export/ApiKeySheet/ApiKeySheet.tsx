import { useState } from 'react'
import { Sheet } from '../../ui/Sheet/Sheet'
import ui from '../../panels/panel.module.css'
import styles from './ApiKeySheet.module.css'

interface ApiKeySheetProps {
  open: boolean
  value: string
  onClose: () => void
  onSave: (key: string) => void
}

export function ApiKeySheet({ open, value, onClose, onSave }: ApiKeySheetProps) {
  const [key, setKey] = useState(value)
  const [visible, setVisible] = useState(false)

  return (
    <Sheet open={open} title="API-ключ Anthropic" onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          onSave(key.trim())
        }}
      >
        <p className={ui.hint}>
          Нужен для ИИ-ассистента: Claude смотрит на фото и подбирает настройки. Ключ хранится только на этом устройстве и отправляется
          напрямую в Anthropic. Удаление фона и авто-улучшение работают без ключа.
        </p>
        <div className={styles.row}>
          <input
            className={styles.input}
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            aria-label="API-ключ"
          />
          <button type="button" className={styles.toggle} onClick={() => setVisible((v) => !v)}>
            {visible ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        <div className={ui.row}>
          {value && (
            <button type="button" className={ui.secondary} onClick={() => onSave('')}>
              Удалить
            </button>
          )}
          <button type="submit" className={ui.primary} disabled={!key.trim() || key.trim() === value}>
            Сохранить
          </button>
        </div>
      </form>
    </Sheet>
  )
}
