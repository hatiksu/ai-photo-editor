import { describe, expect, it } from 'vitest'
import { defaultAdjustments } from '../lib/processing'
import { currentView, editorReducer, initialState, type EditorState } from './editor'

// Для логики истории холсты не нужны по-настоящему — достаточно уникальных объектов
const canvas = (name: string) => ({ name, width: 100, height: 50 }) as unknown as HTMLCanvasElement

function loaded(): EditorState {
  return editorReducer(initialState, { type: 'load', canvas: canvas('orig'), fileName: 'photo' })
}

describe('история правок', () => {
  it('загрузка создаёт первый снимок без правок', () => {
    const s = loaded()
    expect(s.history).toHaveLength(1)
    expect(s.index).toBe(0)
    expect(currentView(s)).toEqual({ base: s.original, adj: defaultAdjustments(), preset: 'Оригинал' })
  })

  it('черновик ползунка не попадает в историю до отпускания', () => {
    let s = loaded()
    s = editorReducer(s, { type: 'draft', adj: { ...defaultAdjustments(), contrast: 30 } })
    expect(s.history).toHaveLength(1)
    expect(currentView(s)!.adj.contrast).toBe(30)
    expect(currentView(s)!.preset).toBeNull()

    s = editorReducer(s, { type: 'commit' })
    expect(s.history).toHaveLength(2)
    expect(s.draft).toBeNull()
    expect(currentView(s)!.adj.contrast).toBe(30)
  })

  it('отмена и повтор', () => {
    let s = loaded()
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: 10 } })
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: 20 } })
    s = editorReducer(s, { type: 'undo' })
    expect(currentView(s)!.adj.exposure).toBe(10)
    s = editorReducer(s, { type: 'redo' })
    expect(currentView(s)!.adj.exposure).toBe(20)
    // За пределы истории не уходим
    expect(editorReducer(s, { type: 'redo' })).toBe(s)
    expect(editorReducer(loaded(), { type: 'undo' }).index).toBe(0)
  })

  it('новое действие после отмены отбрасывает «будущее»', () => {
    let s = loaded()
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: 10 } })
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: 20 } })
    s = editorReducer(s, { type: 'undo' })
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: 99 } })
    expect(s.history.map((h) => h.adj.exposure)).toEqual([0, 10, 99])
    expect(s.index).toBe(2)
  })

  it('смена изображения (обрезка, поворот) сохраняет правки', () => {
    let s = loaded()
    s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), sepia: 40 }, preset: null })
    const cropped = canvas('cropped')
    s = editorReducer(s, { type: 'commit', base: cropped })
    expect(currentView(s)!.base).toBe(cropped)
    expect(currentView(s)!.adj.sepia).toBe(40)
  })

  it('история ограничена 40 шагами', () => {
    let s = loaded()
    for (let i = 1; i <= 60; i++) s = editorReducer(s, { type: 'commit', adj: { ...defaultAdjustments(), exposure: i % 100 } })
    expect(s.history).toHaveLength(40)
    expect(s.index).toBe(39)
    expect(currentView(s)!.adj.exposure).toBe(60)
  })

  it('сброс возвращает оригинал отдельным шагом (его можно отменить)', () => {
    let s = loaded()
    s = editorReducer(s, { type: 'commit', base: canvas('rotated'), adj: { ...defaultAdjustments(), fade: 50 } })
    s = editorReducer(s, { type: 'reset' })
    expect(currentView(s)!.base).toBe(s.original)
    expect(currentView(s)!.adj).toEqual(defaultAdjustments())
    s = editorReducer(s, { type: 'undo' })
    expect(currentView(s)!.adj.fade).toBe(50)
  })

  it('закрытие очищает состояние', () => {
    expect(editorReducer(loaded(), { type: 'close' })).toEqual(initialState)
  })
})
