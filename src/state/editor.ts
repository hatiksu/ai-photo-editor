// Состояние редактора с историей правок. Холсты неизменяемы: каждое действие создаёт новый.
import { defaultAdjustments, type Adjustments } from '../lib/processing'

export interface Snapshot {
  /** Текущее изображение после обрезки, поворотов, удаления фона */
  base: HTMLCanvasElement
  adj: Adjustments
  preset: string | null
}

export interface EditorState {
  original: HTMLCanvasElement | null
  fileName: string
  history: Snapshot[]
  index: number
  /** Черновые значения ползунков, пока палец на слайдере (в историю попадут при отпускании) */
  draft: Adjustments | null
}

export const initialState: EditorState = { original: null, fileName: 'photo', history: [], index: -1, draft: null }

export type EditorAction =
  | { type: 'load'; canvas: HTMLCanvasElement; fileName: string }
  | { type: 'draft'; adj: Adjustments }
  | { type: 'commit'; adj?: Adjustments; preset?: string | null; base?: HTMLCanvasElement }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'close' }

const HISTORY_MAX = 40

function push(state: EditorState, snap: Snapshot): EditorState {
  const history = [...state.history.slice(0, state.index + 1), snap].slice(-HISTORY_MAX)
  return { ...state, history, index: history.length - 1, draft: null }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const current = state.history[state.index]
  switch (action.type) {
    case 'load':
      return {
        original: action.canvas,
        fileName: action.fileName,
        history: [{ base: action.canvas, adj: defaultAdjustments(), preset: 'Оригинал' }],
        index: 0,
        draft: null,
      }
    case 'draft':
      return { ...state, draft: action.adj }
    case 'commit': {
      if (!current) return state
      return push(state, {
        base: action.base ?? current.base,
        adj: action.adj ?? state.draft ?? current.adj,
        preset: action.preset !== undefined ? action.preset : action.adj || state.draft ? null : current.preset,
      })
    }
    case 'undo':
      return state.index > 0 ? { ...state, index: state.index - 1, draft: null } : state
    case 'redo':
      return state.index < state.history.length - 1 ? { ...state, index: state.index + 1, draft: null } : state
    case 'reset':
      if (!state.original) return state
      return push(state, { base: state.original, adj: defaultAdjustments(), preset: 'Оригинал' })
    case 'close':
      return initialState
  }
}

/** Текущие значения: черновик (во время движения ползунка) или из истории. */
export function currentView(state: EditorState) {
  const snap = state.history[state.index]
  return snap ? { base: snap.base, adj: state.draft ?? snap.adj, preset: state.draft ? null : snap.preset } : null
}
