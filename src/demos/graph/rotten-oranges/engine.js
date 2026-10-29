import { cellId } from '../../../core/grid-geom.js'

export const FIXTURE_A = {
  rows: 3,
  cols: 5,
  grid: [
    [2, 1, 1, 0, 0],
    [1, 1, 0, 0, 0],
    [0, 1, 1, 1, 2],
  ],
}

export const FIXTURE_B = {
  rows: 3,
  cols: 5,
  grid: [
    [2, 1, 1, 0, 0],
    [2, 1, 0, 0, 0],
    [0, 0, 1, 1, 1],
  ],
}

export const DEFAULT_DATA = FIXTURE_A

const DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
]

const DECISION_HINT = '队列先进先出：先比变烂的分钟，分钟相同再比行优先。'
const RESULT_HINT = '下一步还是从队列里挑 —— 先烂的先走。'
const DONE_HINT = '每个橘子都烂了 —— 分钟数就是最后一格变烂的时刻。'
const STUCK_HINT = '队列空了还有新鲜橘子 —— 它们被空格隔开，等不到烂橘子。'

function makeState(data) {
  const cells = Array.from({ length: data.rows * data.cols }, (_, index) => {
    const r = Math.floor(index / data.cols)
    const c = index % data.cols
    const value = data.grid[r][c]
    return {
      id: cellId(r, c),
      r,
      c,
      land: value !== 0,
      order: value === 2 ? 0 : null,
    }
  })
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const state = {
    rows: data.rows,
    cols: data.cols,
    cells,
    byId,
    queue: cells.filter((cell) => cell.order === 0).map((cell) => cell.id),
    processed: [],
    minute: 0,
    rotten: cells.filter((cell) => cell.order !== null).length,
    fresh: cells.filter((cell) => cell.land && cell.order === null).length,
    land: cells.filter((cell) => cell.land).length,
    spread: [],
    auto: [],
    cursor: 0,
  }
  sortQueue(state)
  return state
}

function sortQueue(state) {
  state.queue.sort((aId, bId) => {
    const a = state.byId.get(aId)
    const b = state.byId.get(bId)
    return a.order - b.order || a.r - b.r || a.c - b.c
  })
}

function coord(state, id) {
  const cell = state.byId.get(id)
  return `(${cell.r},${cell.c})`
}

function freshCoords(state) {
  return state.cells.filter((cell) => cell.land && cell.order === null).map((cell) => coord(state, cell.id))
}

function processCell(state, id, { automatic = false } = {}) {
  const queueIndex = state.queue.indexOf(id)
  if (queueIndex >= 0) state.queue.splice(queueIndex, 1)
  const source = state.byId.get(id)
  state.processed.push(id)
  if (automatic) state.auto.push(id)

  for (const [dr, dc] of DIRECTIONS) {
    const r = source.r + dr
    const c = source.c + dc
    if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue
    const target = state.byId.get(cellId(r, c))
    if (!target.land || target.order !== null) continue
    target.order = source.order + 1
    state.rotten += 1
    state.fresh -= 1
    state.spread.push({ id: target.id, minute: target.order })
    state.queue.push(target.id)
  }
  sortQueue(state)
  state.minute = Math.max(0, ...state.cells.filter((cell) => cell.order !== null).map((cell) => cell.order))
}

function drainQueue(state) {
  const cleared = []
  while (state.queue.length) {
    const id = state.queue[0]
    cleared.push(id)
    processCell(state, id, { automatic: true })
  }
  return cleared
}

function snapshot(state, { ask = false, caption, hint, done = false, answer = null } = {}) {
  const marks = {}
  state.processed.forEach((id, index) => {
    marks[id] = index === state.processed.length - 1 ? 'active' : 'ok'
  })
  return {
    rows: state.rows,
    cols: state.cols,
    cells: state.cells.map((cell) => ({ ...cell })),
    marks,
    queue: [...state.queue],
    processed: [...state.processed],
    minute: state.minute,
    rotten: state.rotten,
    fresh: state.fresh,
    land: state.land,
    spread: state.spread.map((item) => ({ ...item })),
    auto: [...state.auto],
    cursor: state.cursor,
    ask: ask ? {
      prompt: '下一步处理队列里的哪一格？点网格里的格子。',
      correct: state.queue[0],
    } : null,
    caption,
    hint,
    done,
    answer,
    clickable: ask ? state.cells.map((cell) => cell.id) : [],
  }
}

function terminalCaption(state, answer) {
  if (answer >= 0) return `全部 ${state.land} 个橘子都烂了，用了 ${answer} 分钟 —— 994 的答案是 ${answer}。`
  return `队列空了，${freshCoords(state).join('、')} 还是新鲜的 —— 994 的答案是 -1。`
}

function makeDegenerateFrame(state, caption) {
  state.spread = []
  state.auto = []
  if (state.fresh === 0) {
    drainQueue(state)
    return snapshot(state, {
      caption,
      hint: '每个橘子都烂了 —— 分钟数就是最后一格变烂的时刻。',
      done: true,
      answer: 0,
    })
  }

  if (!state.rotten) {
    return snapshot(state, {
      caption,
      hint: '队列空了还有新鲜橘子 —— 它们被空格隔开，等不到烂橘子。',
      done: true,
      answer: -1,
    })
  }

  while (state.queue.length) processCell(state, state.queue[0], { automatic: true })
  const answer = state.fresh === 0 ? state.minute : -1
  const completeCaption = answer >= 0
    ? `${caption}全部 ${state.land} 个橘子都烂了，用了 ${answer} 分钟 —— 994 的答案是 ${answer}。`
    : `${caption}${terminalCaption(state, answer)}`
  return snapshot(state, {
    caption: completeCaption,
    hint: answer >= 0 ? DONE_HINT : STUCK_HINT,
    done: true,
    answer,
  })
}

function resultCaption(state, pickedId, folded, cleared, answer) {
  const spreadText = state.spread.map(({ id, minute }) => `${coord(state, id)} 第 ${minute} 分钟变烂`).join('，')
  const parts = [spreadText
    ? `处理 ${coord(state, pickedId)}：${spreadText}。`
    : `处理 ${coord(state, pickedId)}：它四邻没有新鲜橘子。`]

  if (folded.length) parts.push(`队列只剩一格，后面不再问，自动处理 ${folded.map((id) => coord(state, id)).join('、')}。`)
  if (cleared.length) {
    parts.push(`剩下的队列格子都不会再让谁变烂，一并处理完（${cleared.map((id) => coord(state, id)).join('、')}）。`)
  }
  if (answer !== null) parts.push(terminalCaption(state, answer))
  return parts.join(' ')
}

function settleAfterPick(state) {
  const folded = []
  let cleared = []

  if (state.fresh === 0) {
    cleared = drainQueue(state)
    return { done: true, answer: state.minute, folded, cleared }
  }

  while (state.queue.length === 1) {
    const id = state.queue[0]
    folded.push(id)
    processCell(state, id, { automatic: true })
    if (state.fresh === 0) {
      cleared = drainQueue(state)
      return { done: true, answer: state.minute, folded, cleared }
    }
    if (!state.queue.length) return { done: true, answer: -1, folded, cleared }
  }

  if (!state.queue.length) return { done: true, answer: -1, folded, cleared }
  return { done: false, answer: null, folded, cleared }
}

export function buildFrames({ data = DEFAULT_DATA, picks = [] } = {}) {
  const state = makeState(data)
  const frames = []

  if (!state.rotten) {
    frames.push(makeDegenerateFrame(state, '网格里没有烂橘子 —— 新鲜橘子永远不会烂，994 的答案是 -1。'))
    return frames
  }
  if (!state.fresh) {
    frames.push(makeDegenerateFrame(state, '没有新鲜橘子 —— 一开始就是全烂，0 分钟，994 的答案是 0。'))
    return frames
  }
  if (state.queue.length === 1) {
    frames.push(makeDegenerateFrame(state, '开局只有 1 个烂橘子 —— 没有可判断的先后，直接一次跑完。'))
    return frames
  }

  frames.push(snapshot(state, {
    ask: true,
    caption: `${state.rows}×${state.cols} 网格，${state.rotten} 个烂橘子、${state.fresh} 个新鲜橘子。烂橘子在第 0 分钟一起进队；处理一格时，它的新鲜四邻一起变烂、排到队尾。队列先比变烂的分钟，分钟相同再按行优先 —— 下一步处理哪一格由你判断。`,
    hint: DECISION_HINT,
  }))

  for (const pick of picks) {
    const decision = frames.at(-1)
    if (!decision.ask || decision.done) break
    if (!checkPick(decision, pick).ok) continue

    state.spread = []
    state.auto = []
    state.cursor += 1
    processCell(state, pick)
    const settled = settleAfterPick(state)
    frames.push(snapshot(state, {
      caption: resultCaption(state, pick, settled.folded, settled.cleared, settled.answer),
      hint: settled.done ? (settled.answer >= 0 ? DONE_HINT : STUCK_HINT) : RESULT_HINT,
      done: settled.done,
      answer: settled.answer,
    }))

    if (!settled.done) {
      frames.push(snapshot(state, {
        ask: true,
        caption: `已烂 ${state.rotten} / ${state.land} 格，队列里还有 ${state.queue.length} 格。轮到你判断下一步。`,
        hint: DECISION_HINT,
      }))
    }
  }

  return frames
}

export function checkPick(frame, pick) {
  if (frame.done) return { ok: false, message: '已经结束了，没有下一步要处理。' }
  if (!frame.ask) return { ok: false, message: '现在没有要你决定的格子。' }
  const cell = frame.cells.find((item) => item.id === pick)
  if (!cell) return { ok: false, message: `没有这一格：${pick}` }
  if (!cell.land) return { ok: false, message: `(${cell.r},${cell.c}) 是空格 —— 空格永远不参与腐烂。` }
  if (cell.order === null) return { ok: false, message: `(${cell.r},${cell.c}) 还没变烂 —— 只有已经烂的格子才在队列里。` }
  if (frame.processed.includes(pick)) return { ok: false, message: `(${cell.r},${cell.c}) 已经处理过了 —— 每格只处理一次。` }

  const first = frame.cells.find((item) => item.id === frame.queue[0])
  if (pick !== first.id) {
    if (cell.order === first.order) {
      return {
        ok: false,
        message: `(${cell.r},${cell.c}) 和 (${first.r},${first.c}) 都是第 ${cell.order} 分钟变烂，同一分钟按行优先 —— (${first.r},${first.c}) 在前。`,
      }
    }
    return {
      ok: false,
      message: `(${cell.r},${cell.c}) 是第 ${cell.order} 分钟才变烂，(${first.r},${first.c}) 第 ${first.order} 分钟就烂了 —— 先烂的先走。`,
    }
  }
  return { ok: true, message: '' }
}
