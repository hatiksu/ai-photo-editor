import { describe, expect, it } from 'vitest'
import { ADJ_KEYS, PRESETS, RANGES, applyAdjustments, autoEnhance, clampAdjustments, defaultAdjustments, type Adjustments } from './processing'

/** Однотонное изображение w×h */
function solid(w: number, h: number, [r, g, b, a = 255]: number[]): ImageData {
  const img = new ImageData(w, h)
  for (let i = 0; i < img.data.length; i += 4) img.data.set([r, g, b, a], i)
  return img
}

const px = (img: ImageData, x: number, y: number) => {
  const i = (y * img.width + x) * 4
  return [...img.data.slice(i, i + 4)]
}

const adj = (p: Partial<Adjustments>) => ({ ...defaultAdjustments(), ...p })

describe('applyAdjustments', () => {
  it('без правок изображение не меняется', () => {
    const src = solid(4, 4, [120, 80, 200, 255])
    expect([...applyAdjustments(src, defaultAdjustments()).data]).toEqual([...src.data])
  })

  it('не портит исходник и сохраняет прозрачность', () => {
    const src = solid(2, 2, [100, 100, 100, 40])
    const copy = [...src.data]
    const out = applyAdjustments(src, adj({ exposure: 50, contrast: 30 }))
    expect([...src.data]).toEqual(copy)
    expect(px(out, 0, 0)[3]).toBe(40)
  })

  it('экспозиция и яркость осветляют', () => {
    const src = solid(1, 1, [100, 100, 100])
    expect(px(applyAdjustments(src, adj({ exposure: 50 })), 0, 0)[0]).toBeGreaterThan(150)
    expect(px(applyAdjustments(src, adj({ brightness: -50 })), 0, 0)[0]).toBeLessThan(100)
  })

  it('Ч/Б 100 делает каналы равными', () => {
    const [r, g, b] = px(applyAdjustments(solid(1, 1, [220, 40, 90]), adj({ grayscale: 100 })), 0, 0)
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('температура: плюс — теплее (больше красного, меньше синего)', () => {
    const [r, , b] = px(applyAdjustments(solid(1, 1, [128, 128, 128]), adj({ temperature: 60 })), 0, 0)
    expect(r).toBeGreaterThan(128)
    expect(b).toBeLessThan(128)
  })

  it('виньетка затемняет углы, но не центр', () => {
    const out = applyAdjustments(solid(41, 41, [200, 200, 200]), adj({ vignette: 100 }))
    expect(px(out, 20, 20)[0]).toBe(200)
    expect(px(out, 0, 0)[0]).toBeLessThan(120)
  })

  it('значения не выходят за 0–255', () => {
    const out = applyAdjustments(solid(2, 2, [250, 5, 250]), adj({ exposure: 100, contrast: 100, saturation: 100 }))
    for (const v of out.data) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(255)
    }
  })
})

describe('clampAdjustments', () => {
  it('обрезает по диапазонам, округляет и чинит мусор', () => {
    const c = clampAdjustments({ exposure: 250, sharpness: -10, contrast: 12.6, tint: 'abc', unknown: 5 })
    expect(c.exposure).toBe(100)
    expect(c.sharpness).toBe(0)
    expect(c.contrast).toBe(13)
    expect(c.tint).toBe(0)
    expect(Object.keys(c).sort()).toEqual([...ADJ_KEYS].sort())
  })

  it('null и undefined дают нули', () => {
    expect(clampAdjustments(null)).toEqual(defaultAdjustments())
  })
})

describe('фильтры', () => {
  it('у всех фильтров полный набор значений в допустимых диапазонах', () => {
    for (const p of PRESETS) {
      for (const k of ADJ_KEYS) {
        const [lo, hi] = RANGES[k]
        expect(p.adj[k], `${p.name}.${k}`).toBeGreaterThanOrEqual(lo)
        expect(p.adj[k], `${p.name}.${k}`).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('«Оригинал» ничего не меняет', () => {
    expect(PRESETS.find((p) => p.name === 'Оригинал')!.adj).toEqual(defaultAdjustments())
  })
})

describe('autoEnhance', () => {
  it('тёмное фото — поднимает экспозицию', () => {
    expect(autoEnhance(solid(20, 20, [30, 30, 30])).exposure).toBeGreaterThan(0)
  })

  it('синеватое фото — делает теплее', () => {
    expect(autoEnhance(solid(20, 20, [90, 110, 170])).temperature).toBeGreaterThan(0)
  })

  it('полностью прозрачное изображение — без правок', () => {
    expect(autoEnhance(solid(10, 10, [0, 0, 0, 0]))).toEqual(defaultAdjustments())
  })

  it('результат всегда в допустимых диапазонах', () => {
    const r = autoEnhance(solid(10, 10, [255, 0, 255]))
    for (const k of ADJ_KEYS) {
      expect(r[k]).toBeGreaterThanOrEqual(RANGES[k][0])
      expect(r[k]).toBeLessThanOrEqual(RANGES[k][1])
    }
  })
})
