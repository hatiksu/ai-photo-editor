import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Icon } from '../../ui/Icon/Icon'
import styles from './Welcome.module.css'

interface WelcomeProps {
  onFile: (file: File) => void
  onSample: () => void
}

const FEATURES = [
  { icon: '✂️', text: 'Удаление фона нейросетью прямо на телефоне' },
  { icon: '✨', text: 'Авто-улучшение в одно касание' },
  { icon: '💬', text: '«Сделай как на закате» — ИИ подберёт настройки' },
  { icon: '🎚️', text: '15 настроек, 12 фильтров, обрезка' },
]

/** Стартовый экран: выбрать фото, снять камерой или попробовать на примере. */
export function Welcome({ onFile, onSample }: WelcomeProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onFile(f)
  }

  return (
    <div
      className={`${styles.welcome} ${over ? styles.over : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <motion.div className={styles.inner} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={styles.logo} width={72} height={72} />
        <h1 className={styles.title}>
          Фоторедактор <span>с ИИ</span>
        </h1>
        <p className={styles.lead}>Фото обрабатываются прямо на устройстве и никуда не загружаются.</p>

        <div className={styles.actions}>
          <motion.button type="button" className={styles.primary} onClick={() => fileRef.current?.click()} whileTap={{ scale: 0.97 }}>
            <Icon name="image" /> Выбрать фото
          </motion.button>
          <motion.button type="button" className={styles.secondary} onClick={() => cameraRef.current?.click()} whileTap={{ scale: 0.97 }}>
            <Icon name="camera" /> Снять
          </motion.button>
        </div>
        <button type="button" className={styles.sample} onClick={onSample}>
          Попробовать на примере →
        </button>

        <ul className={styles.features}>
          {FEATURES.map((f, i) => (
            <motion.li key={f.text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}>
              <span>{f.icon}</span>
              {f.text}
            </motion.li>
          ))}
        </ul>
        <p className={styles.desktopHint}>Можно перетащить фото сюда или вставить из буфера (Ctrl+V)</p>
      </motion.div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </div>
  )
}
