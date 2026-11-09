import { FULL_RECT, cropCanvas, fitRect, transformCanvas, type TransformKind } from '../../../lib/image'
import { useEditor } from '../../../state/EditorContext'
import { Chip } from '../../ui/Chip/Chip'
import { Icon, type IconName } from '../../ui/Icon/Icon'
import ui from '../panel.module.css'

const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Свободно', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
]

const TRANSFORMS: { kind: TransformKind; icon: IconName; label: string }[] = [
  { kind: 'rotateLeft', icon: 'rotateLeft', label: 'Влево' },
  { kind: 'rotateRight', icon: 'rotateRight', label: 'Вправо' },
  { kind: 'flipH', icon: 'flipH', label: 'Зеркало' },
  { kind: 'flipV', icon: 'flipV', label: 'Переворот' },
]

export function CropPanel() {
  const { view, crop, setCrop, dispatch, setCutout } = useEditor()
  const imageAspect = view.base.width / view.base.height
  const isFull = crop.rect.x < 0.001 && crop.rect.y < 0.001 && crop.rect.w > 0.999 && crop.rect.h > 0.999

  const transform = (kind: TransformKind) => {
    setCutout(null)
    const next = transformCanvas(view.base, kind)
    dispatch({ type: 'commit', base: next })
    setCrop({ aspect: crop.aspect, rect: fitRect(crop.aspect, next.width / next.height) })
  }

  const apply = () => {
    setCutout(null)
    const next = cropCanvas(view.base, crop.rect)
    dispatch({ type: 'commit', base: next })
    setCrop({ aspect: null, rect: { ...FULL_RECT } })
  }

  return (
    <div className={ui.panel}>
      <div className={ui.scroller}>
        {ASPECTS.map((a) => (
          <Chip key={a.label} active={crop.aspect === a.value} onClick={() => setCrop({ aspect: a.value, rect: fitRect(a.value, imageAspect) })}>
            {a.label}
          </Chip>
        ))}
      </div>
      <div className={ui.row}>
        {TRANSFORMS.map((t) => (
          <button key={t.kind} type="button" className={ui.iconButton} onClick={() => transform(t.kind)}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
      <div className={ui.row}>
        <button type="button" className={ui.secondary} disabled={isFull} onClick={() => setCrop({ aspect: null, rect: { ...FULL_RECT } })}>
          Сбросить рамку
        </button>
        <button type="button" className={ui.primary} disabled={isFull} onClick={apply}>
          <Icon name="check" size={18} /> Обрезать
        </button>
      </div>
    </div>
  )
}
