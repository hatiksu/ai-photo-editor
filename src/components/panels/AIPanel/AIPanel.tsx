import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { canvasToBase64, composeBackground, type Backdrop } from '../../../lib/image'
import { autoEnhance } from '../../../lib/processing'
import { useEditor } from '../../../state/EditorContext'
import { Chip } from '../../ui/Chip/Chip'
import { Icon } from '../../ui/Icon/Icon'
import ui from '../panel.module.css'
import styles from './AIPanel.module.css'

const SUGGESTIONS = [
  { label: '✨ Сделай красиво', prompt: 'Профессионально отретушируй это фото, сделай его максимально выигрышным' },
  { label: '🎬 Кино', prompt: 'Кинематографичный вид: приглушённые цвета, глубокие тени, лёгкая виньетка' },
  { label: '☀️ Лето', prompt: 'Яркое летнее настроение, сочные тёплые цвета' },
  { label: '🖤 Ч/Б арт', prompt: 'Стильное чёрно-белое фото с высоким контрастом' },
  { label: '🎞️ Плёнка', prompt: 'Мягкий винтажный плёночный стиль' },
  { label: '🌅 Закат', prompt: 'Тёплый закатный свет, мягкие тени' },
]

const BACKDROPS: { label: string; value: Backdrop }[] = [
  { label: 'Прозрачный', value: { kind: 'transparent' } },
  { label: 'Белый', value: { kind: 'color', color: '#ffffff' } },
  { label: 'Чёрный', value: { kind: 'color', color: '#000000' } },
  { label: 'Размытый', value: { kind: 'blur' } },
]

export function AIPanel() {
  const { view, preview, dispatch, toast, setBusy, apiKey, openApiKey, previewCanvas, cutout, setCutout } = useEditor()
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<{ explanation: string; caption: string } | null>(null)
  const [backdrop, setBackdrop] = useState('Прозрачный')
  const [customColor, setCustomColor] = useState('#7c5cff')

  const enhance = () => {
    dispatch({ type: 'commit', adj: autoEnhance(preview), preset: null })
    toast('Подобраны экспозиция, контраст и баланс белого')
  }

  const removeBg = async () => {
    setBusy('Загрузка нейросети…')
    try {
      const { removeBackground } = await import('../../../lib/bgRemoval')
      const source = view.base
      const cut = await removeBackground(source, (stage, ratio) =>
        setBusy(`${stage === 'download' ? 'Загрузка нейросети' : 'Удаление фона'}… ${Math.round(ratio * 100)}%`),
      )
      setCutout({ cutout: cut, source })
      setBackdrop('Прозрачный')
      dispatch({ type: 'commit', base: cut })
      toast('Фон удалён — выберите новый или сохраните PNG')
    } catch (err) {
      console.error(err)
      toast(`Не удалось удалить фон: ${err instanceof Error ? err.message : err}`, { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const applyBackdrop = (label: string, value: Backdrop) => {
    if (!cutout) return
    setBackdrop(label)
    dispatch({ type: 'commit', base: composeBackground(cutout.cutout, cutout.source, value) })
  }

  const ask = async (instruction: string) => {
    if (!instruction.trim()) return
    if (!apiKey) {
      openApiKey()
      return
    }
    const canvas = previewCanvas.current
    if (!canvas) return
    setBusy('Claude смотрит на фото…')
    try {
      const { askAssistant } = await import('../../../lib/ai')
      const res = await askAssistant({ apiKey, imageBase64: canvasToBase64(canvas), instruction, current: view.adj })
      dispatch({ type: 'commit', adj: res.adjustments, preset: null })
      setResult({ explanation: res.explanation, caption: res.caption })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка ИИ-ассистента', { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const copyCaption = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.caption)
      toast('Подпись скопирована')
    } catch {
      toast('Не удалось скопировать', { tone: 'error' })
    }
  }

  return (
    <div className={`${ui.panel} ${styles.panel}`}>
      <div className={ui.row}>
        <button type="button" className={styles.action} onClick={enhance}>
          <span className={styles.actionIcon}>
            <Icon name="wand" />
          </span>
          <span>
            <strong>Авто-улучшение</strong>
            <small>Без интернета</small>
          </span>
        </button>
        <button type="button" className={styles.action} onClick={removeBg}>
          <span className={styles.actionIcon}>
            <Icon name="scissors" />
          </span>
          <span>
            <strong>Удалить фон</strong>
            <small>Нейросеть на устройстве</small>
          </span>
        </button>
      </div>

      {cutout && view.base !== cutout.source && (
        <div className={ui.scroller} aria-label="Новый фон">
          {BACKDROPS.map((b) => (
            <Chip key={b.label} active={backdrop === b.label} onClick={() => applyBackdrop(b.label, b.value)}>
              {b.label}
            </Chip>
          ))}
          <label className={styles.colorChip}>
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value)
                applyBackdrop('Цвет', { kind: 'color', color: e.target.value })
              }}
            />
            Свой цвет
          </label>
        </div>
      )}

      <form
        className={styles.ask}
        onSubmit={(e) => {
          e.preventDefault()
          ask(prompt)
        }}
      >
        <input
          className={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Опишите, что сделать с фото…"
          aria-label="Пожелание для ИИ"
          enterKeyHint="send"
        />
        <button type="submit" className={styles.send} disabled={!prompt.trim()} aria-label="Отправить">
          <Icon name="send" size={20} />
        </button>
      </form>

      <div className={ui.scroller}>
        {SUGGESTIONS.map((s) => (
          <Chip
            key={s.label}
            onClick={() => {
              setPrompt(s.prompt)
              ask(s.prompt)
            }}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div className={styles.result} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <p>{result.explanation}</p>
            {result.caption && (
              <button type="button" className={styles.caption} onClick={copyCaption}>
                <span>«{result.caption}»</span>
                <Icon name="copy" size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" className={`${ui.textButton} ${styles.keyButton}`} onClick={openApiKey}>
        <Icon name="key" size={16} /> {apiKey ? 'API-ключ Anthropic сохранён' : 'Добавить API-ключ Anthropic'}
      </button>
    </div>
  )
}
