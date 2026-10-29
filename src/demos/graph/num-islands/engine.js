import { DIR_ORDER, cellId, neighbor } from '../../../core/grid-geom.js'

export const FIXTURE_A = {
  rows: 4,
  cols: 5,
  grid: [
    [1, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 1],
  ],
}

export const FIXTURE_B = {
  rows: 5,
  cols: 5,
  grid: [
    [1, 1, 1, 0, 1],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1],
  ],
}

export const DEFAULT_DATA = FIXTURE_A

const OPTIONS = [
  { pick: 'up', label: '↑ 上' },
  { pick: 'right', label: '→ 右' },
  { pick: 'down', label: '↓ 下' },
  { pick: 'left', label: '← 左' },
]

const DIR_LABEL = { up: '上', right: '右', down: '下', left: '左' }

function makeCells(data) {
  return Array.from({ length: data.rows * data.cols }, (_, i) => {
    const r = Math.floor(i / data.cols)
    const c = i % data.cols
    return { id: cellId(r, c), r, c, land: data.grid[r][c] === 1, order: null }
  })
}

function legalDirections(cells, rows, cols, at) {
  const byCoord = new Map(cells.map((cell) => [`${cell.r},${cell.c}`, cell]))
  return DIR_ORDER.filter((dir) => {
    const pos = neighbor(at.r, at.c, dir, rows, cols)
    if (!pos) return false
    const cell = byCoord.get(`${pos.r},${pos.c}`)
    return cell.land && cell.order === null
  })
}

function snapshot(state, { ask = null, caption, hint, done = false } = {}) {
  const cells = state.cells.map((cell) => ({ ...cell }))
  const stack = [...state.stack]
  const marks = Object.fromEntries(cells
    .filter((cell) => cell.order !== null)
    .map((cell) => [cell.id, stack.at(-1) === cell.id ? 'active' : 'ok']))
  return {
    rows: state.rows,
    cols: state.cols,
    cells,
    marks,
    stack,
    count: state.count,
    visited: state.visited,
    popped: [...state.popped],
    seeded: [...state.seeded],
    cursor: state.cursor,
    ask,
    caption,
    hint,
    done,
    clickable: [],
  }
}

function cellAt(cells, r, c) {
  return cells.find((cell) => cell.r === r && cell.c === c)
}

function createAsk(state, at) {
  const current = cellAt(state.cells, at.r, at.c)
  return {
    prompt: `从 (${at.r},${at.c}) 出发，按 上→右→下→左 的顺序，第一个还能走的陆地邻居在哪边？`,
    options: OPTIONS.map((option) => ({ ...option })),
    correct: legalDirections(state.cells, state.rows, state.cols, at)[0],
    at: { r: at.r, c: at.c },
    atId: current.id,
  }
}

function seed(state, cell) {
  state.count += 1
  state.visited += 1
  cell.order = state.visited
  state.stack.push(cell.id)
  state.seeded.push(cell.id)
}

function prepareDecision(state) {
  state.popped = []
  state.seeded = []
  while (true) {
    while (state.stack.length) {
      const id = state.stack.at(-1)
      const at = state.cells.find((cell) => cell.id === id)
      if (legalDirections(state.cells, state.rows, state.cols, at).length) return true
      state.popped.push(state.stack.pop())
    }

    const next = state.cells.find((cell) => cell.land && cell.order === null)
    if (!next) return false
    seed(state, next)
    if (legalDirections(state.cells, state.rows, state.cols, next).length) return true
    state.popped.push(state.stack.pop())
  }
}

function decisionCaption(state, at) {
  const parts = []
  if (state.popped.length) {
    parts.push(`无路可走，退栈 ${state.popped.length} 格（${state.popped.join('、')}）。`)
  }
  if (state.seeded.length) {
    if (state.seeded.length === 1) {
      parts.push(`栈空 → 换岛：行优先种下 ${state.seeded[0]}，岛数 ${state.count}。`)
    } else {
      parts.push(`栈空 → 换岛：依次种下 ${state.seeded.join('、')}（前面几块种下就无路可走，单格成岛），岛数 ${state.count}。`)
    }
  }
  parts.push(`现在站在 (${at.r},${at.c})。`)
  return parts.join(' ')
}

export function buildFrames({ data = DEFAULT_DATA, picks = [] } = {}) {
  const state = {
    rows: data.rows,
    cols: data.cols,
    cells: makeCells(data),
    stack: [],
    count: 0,
    visited: 0,
    popped: [],
    seeded: [],
    cursor: 0,
  }
  const frames = []
  const first = state.cells.find((cell) => cell.land)
  if (!first) {
    frames.push(snapshot(state, {
      caption: `网格 ${state.rows}×${state.cols}，没有一块陆地 —— 岛数是 0。`,
      hint: '全水网格已经扫完。',
      done: true,
    }))
    return frames
  }

  seed(state, first)
  state.popped = []
  state.seeded = [first.id]
  let at = { r: first.r, c: first.c }
  const landCount = state.cells.filter((cell) => cell.land).length
  frames.push(snapshot(state, {
    ask: createAsk(state, at),
    caption: `网格 ${state.rows}×${state.cols}，${landCount} 块陆地。按行优先找到第一块陆地 (${at.r},${at.c})，岛数记 1，从这里开始深搜。`,
    hint: '从栈顶开始，按上 → 右 → 下 → 左检查四邻。',
  }))

  for (const pick of picks) {
    const current = frames.at(-1)
    if (!current.ask || current.done) break
    if (!checkPick(current, pick).ok) continue

    const from = { ...at }
    const next = neighbor(at.r, at.c, pick, state.rows, state.cols)
    const cell = cellAt(state.cells, next.r, next.c)
    cell.order = ++state.visited
    state.stack.push(cell.id)
    state.cursor += 1
    at = { r: next.r, c: next.c }
    state.popped = []
    state.seeded = []
    frames.push(snapshot(state, {
      caption: `(${from.r},${from.c}) → (${at.r},${at.c})：第 ${cell.order} 块陆地入栈，栈深 ${state.stack.length}。`,
      hint: `已访问 ${state.visited} / ${landCount} 块陆地。`,
    }))

    const canAsk = prepareDecision(state)
    if (!canAsk) {
      frames.push(snapshot(state, {
        caption: `栈空了，也没有没访问的陆地了 —— 全部扫完，共 ${state.count} 个岛。`,
        hint: `已访问 ${state.visited} / ${landCount} 块陆地。`,
        done: true,
      }))
      break
    }

    at = (() => {
      const top = state.cells.find((item) => item.id === state.stack.at(-1))
      return { r: top.r, c: top.c }
    })()
    frames.push(snapshot(state, {
      ask: createAsk(state, at),
      caption: decisionCaption(state, at),
      hint: `已访问 ${state.visited} / ${landCount} 块陆地。`,
    }))
  }

  return frames
}

export function checkPick(frame, pick) {
  if (!DIR_ORDER.includes(pick)) return { ok: false, message: '这不是一个方向：上 / 右 / 下 / 左。' }
  if (!frame.ask) return { ok: false, message: '现在没有需要选择的方向。' }

  const { r, c } = frame.ask.at
  const pos = neighbor(r, c, pick, frame.rows, frame.cols)
  if (!pos) return { ok: false, message: `(${r + (pick === 'down' ? 1 : pick === 'up' ? -1 : 0)},${c + (pick === 'right' ? 1 : pick === 'left' ? -1 : 0)}) 越界 —— 网格外没有路` }
  const target = cellAt(frame.cells, pos.r, pos.c)
  if (!target.land) return { ok: false, message: `(${pos.r},${pos.c}) 是水 —— DFS 只走陆地` }
  if (target.order !== null) return { ok: false, message: `(${pos.r},${pos.c}) 已经访问过 —— 走回去就死循环了` }
  if (pick !== frame.ask.correct) {
    return { ok: false, message: `(${pos.r},${pos.c}) 也还没访问，但按 上→右→下→左 的顺序，${DIR_LABEL[frame.ask.correct]} 排在前面` }
  }
  return { ok: true, message: '' }
}
