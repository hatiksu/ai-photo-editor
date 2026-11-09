import { describe, expect, it } from 'vitest'
import { FULL_RECT, fitRect } from './image'

describe('рамка обрезки', () => {
  it('без пропорции — всё изображение', () => {
    expect(fitRect(null, 4 / 3)).toEqual(FULL_RECT)
  })

  it('квадрат на горизонтальном фото 4:3 — по высоте, по центру', () => {
    const r = fitRect(1, 4 / 3)
    expect(r.h).toBe(1)
    expect(r.w).toBeCloseTo(0.75)
    expect(r.x).toBeCloseTo(0.125)
    expect(r.y).toBe(0)
  })

  it('16:9 на вертикальном фото 3:4 — по ширине, по центру', () => {
    const r = fitRect(16 / 9, 3 / 4)
    expect(r.w).toBe(1)
    expect(r.h).toBeCloseTo(0.421875)
    expect(r.y).toBeCloseTo((1 - 0.421875) / 2)
  })

  it('рамка всегда внутри изображения', () => {
    for (const aspect of [1, 4 / 5, 3 / 4, 4 / 3, 9 / 16, 16 / 9]) {
      for (const image of [1, 4 / 3, 3 / 4, 2, 0.5]) {
        const r = fitRect(aspect, image)
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.y).toBeGreaterThanOrEqual(0)
        expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9)
        expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9)
        // Пропорция в пикселях совпадает с запрошенной
        expect((r.w * image) / r.h).toBeCloseTo(aspect)
      }
    }
  })
})
