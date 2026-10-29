const NODES = [
  { id: 'n1', label: 'N1', x: 70, y: 140 },
  { id: 'n2', label: 'N2', x: 250, y: 60 },
  { id: 'n3', label: 'N3', x: 250, y: 230 },
  { id: 'n4', label: 'N4', x: 430, y: 60 },
  { id: 'n5', label: 'N5', x: 430, y: 230 },
  { id: 'n6', label: 'N6', x: 590, y: 145 },
]

export const FIXTURE_A = {
  name: 'A',
  source: 'n1',
  nodes: NODES,
  edges: [
    { from: 'n1', to: 'n2', w: 1, side: -1 }, // 固定翻到反法向：默认侧与 n1→n4 仅 7.8px，side:-1 后余隙 31.3px。
    { from: 'n2', to: 'n3', w: 2 },
    { from: 'n1', to: 'n4', w: 3, at: 0.35 }, // 固定偏离中点：中点被 n2→n3 穿过（余隙 2.6px），at:0.35 后余隙 38.8px。
    { from: 'n3', to: 'n4', w: 1 },
    { from: 'n3', to: 'n5', w: 4 },
    { from: 'n4', to: 'n5', w: 2 },
    { from: 'n5', to: 'n6', w: 3 },
    { from: 'n2', to: 'n6', w: 9 },
  ],
}

export const FIXTURE_B = {
  name: 'B',
  source: 'n1',
  nodes: NODES,
  edges: [
    { from: 'n1', to: 'n2', w: 4 },
    { from: 'n1', to: 'n3', w: 1 },
    { from: 'n2', to: 'n4', w: 5 },
    { from: 'n3', to: 'n4', w: 1 },
    { from: 'n3', to: 'n5', w: 6 },
    { from: 'n4', to: 'n5', w: 2 },
  ],
}

export const DEFAULT_DATA = FIXTURE_A

const DECISION_HINT = '取距离最小的那个；距离相同取下标小的。'
const RESULT_HINT = '下一步还是从待定点里取距离最小的。'
const COMPLETE_HINT = '每个点都定型了 —— 最大距离就是答案。'
const UNREACHABLE_HINT = '还有点的距离是 ∞ —— 从起点走不到，答案是 −1。'

function labelOf(state, id) {
  return state.nodeById.get(id)?.label ?? id
}

function sortCandidates(state) {
  return state.nodes
    .filter((node) => !node.settled && node.dist !== null)
    .map((node) => ({ id: node.id, dist: node.dist }))
    .sort((a, b) => a.dist - b.dist || state.nodeIndex.get(a.id) - state.nodeIndex.get(b.id))
}

function makeState(data) {
  const nodes = data.nodes.map((node) => ({
    ...node,
    dist: null,
    settled: false,
    badge: '∞',
  }))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const state = {
    nodes,
    nodeById,
    nodeIndex: new Map(nodes.map((node, index) => [node.id, index])),
    edges: data.edges.map((edge) => ({
      ...edge,
      id: `${edge.from}>${edge.to}`,
      at: edge.at ?? 0.5,
      side: edge.side ?? 1,
    })),
    source: data.source,
    dist: Object.fromEntries(nodes.map((node) => [node.id, null])),
    settled: [],
    relaxed: [],
    folded: [],
    cursor: 0,
  }
  return state
}

function updateDistance(state, id, value) {
  state.dist[id] = value
  const node = state.nodeById.get(id)
  node.dist = value
  node.badge = String(value)
}

function relaxFrom(state, id) {
  const sourceDistance = state.dist[id]
  for (const edge of state.edges) {
    if (edge.from !== id) continue
    const before = state.dist[edge.to]
    const next = sourceDistance + edge.w
    if (before !== null && next >= before) continue
    updateDistance(state, edge.to, next)
    state.relaxed.push({ id: edge.to, from: before, to: next, via: id })
  }
}

function settle(state, id) {
  const node = state.nodeById.get(id)
  node.settled = true
  state.settled.push(id)
  relaxFrom(state, id)
}

function farthestNodes(state) {
  const reachable = state.nodes.filter((node) => node.dist !== null)
  const maxDistance = Math.max(...reachable.map((node) => node.dist))
  return reachable.filter((node) => node.dist === maxDistance)
}

function terminal(state) {
  const unreachable = state.nodes.filter((node) => node.dist === null)
  if (unreachable.length) return { answer: -1, unreachable }
  const farthest = farthestNodes(state)
  return { answer: farthest[0].dist, unreachable: [], farthest }
}

function terminalCaption(state, outcome) {
  if (outcome.answer < 0) {
    const names = outcome.unreachable.map((node) => node.label).join('、')
    return `待定点空了，${names} 的距离还是 ∞ —— 从起点走不到，743 的答案是 -1。`
  }
  const names = outcome.farthest.map((node) => node.label).join('、')
  return `全部 ${state.nodes.length} 个点都定型了，最远的是 ${names}，距离 ${outcome.answer} —— 743 的答案是 ${outcome.answer}。`
}

function resultCaption(state, pickedId, outcome) {
  const changed = state.relaxed
  const first = changed.length
    ? `定型 ${labelOf(state, pickedId)}：${changed.map(({ id, from, to }) => `${labelOf(state, id)} ${from === null ? '∞' : from} → ${to}`).join('，')}。`
    : `定型 ${labelOf(state, pickedId)}：没有能改小的出边。`

  const parts = [first]
  for (const id of state.folded) {
    const label = labelOf(state, id)
    parts.push(`候选只剩 ${label}，自动取掉。`)
  }
  if (outcome) parts.push(terminalCaption(state, outcome))
  return parts.join(' ')
}

function snapshot(state, { ask = false, caption, hint, done = false, answer = null } = {}) {
  const marks = {}
  state.settled.forEach((id, index) => {
    marks[id] = index === state.settled.length - 1 ? 'active' : 'ok'
  })
  const candidates = sortCandidates(state)
  return {
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
    marks,
    dist: { ...state.dist },
    settled: [...state.settled],
    candidates,
    relaxed: state.relaxed.map((item) => ({ ...item })),
    folded: [...state.folded],
    cursor: state.cursor,
    ask: ask ? {
      prompt: '下一个取哪个点？点图上的节点。',
      correct: candidates[0]?.id ?? null,
    } : null,
    caption,
    hint,
    done,
    answer,
    clickable: ask ? state.nodes.map((node) => node.id) : [],
  }
}

function openingCaption(state) {
  const outgoing = state.edges.filter((edge) => edge.from === state.source)
  const source = labelOf(state, state.source)
  const given = outgoing.map((edge) => `${labelOf(state, edge.to)}=${edge.w}`).join('、')
  return `起点 ${source} 距离 0，已定型；它的出边给出 ${given}。下一步取哪个点由你判断。`
}

function runAutomatic(state) {
  while (sortCandidates(state).length === 1) {
    const id = sortCandidates(state)[0].id
    state.folded.push(id)
    settle(state, id)
  }
}

function degenerateFrame(state) {
  const outcome = terminal(state)
  let caption
  if (state.nodes.length === 1) {
    caption = '图里只有 1 个点，起点就是终点 —— 没有要判断的，距离 0，743 的答案是 0。'
  } else if (!state.edges.some((edge) => edge.from === state.source)) {
    const unreachable = state.nodes.filter((node) => node.id !== state.source).map((node) => node.label).join('、')
    caption = `起点 ${labelOf(state, state.source)} 距离 0，但它没有出边；${unreachable} 的距离都是 ∞ —— 没有可判断的，从起点走不到，743 的答案是 -1。`
  } else {
    const first = openingCaption(state).replace('下一步取哪个点由你判断。', '')
    const allSettled = state.settled.length === state.nodes.length
    if (allSettled) {
      const farthest = farthestNodes(state).map((node) => node.label).join('、')
      caption = `${first}往后每一步都只剩 1 个候选，没有要判断的。全部 ${state.nodes.length} 个点都定型了，最远的是 ${farthest}，距离 ${outcome.answer} —— 743 的答案是 ${outcome.answer}。`
    } else {
      caption = `${first}没有可判断的先后。${terminalCaption(state, outcome)}`
    }
  }
  return snapshot(state, {
    caption,
    hint: outcome.answer < 0 ? UNREACHABLE_HINT : COMPLETE_HINT,
    done: true,
    answer: outcome.answer,
  })
}

function initialState(data) {
  const state = makeState(data)
  updateDistance(state, state.source, 0)
  settle(state, state.source)
  // 起点的松弛属于开局帧，决策帧本身不携带本帧 relaxed 事件。
  state.relaxed = []
  return state
}

export function buildFrames({ data = DEFAULT_DATA, picks = [] } = {}) {
  const state = initialState(data)
  const frames = []
  const initialCandidates = sortCandidates(state)

  if (!initialCandidates.length) {
    frames.push(degenerateFrame(state))
    return frames
  }
  if (initialCandidates.length === 1) {
    runAutomatic(state)
    if (!sortCandidates(state).length) {
      frames.push(degenerateFrame(state))
      return frames
    }
  }

  frames.push(snapshot(state, {
    ask: true,
    caption: openingCaption(state),
    hint: DECISION_HINT,
  }))

  for (const pick of picks) {
    const decision = frames.at(-1)
    if (!decision.ask || decision.done) break
    if (!checkPick(decision, pick).ok) continue

    state.relaxed = []
    state.folded = []
    state.cursor += 1
    settle(state, pick)
    runAutomatic(state)
    const candidates = sortCandidates(state)
    const outcome = candidates.length ? null : terminal(state)
    const done = outcome !== null
    frames.push(snapshot(state, {
      caption: resultCaption(state, pick, outcome),
      hint: done ? (outcome.answer < 0 ? UNREACHABLE_HINT : COMPLETE_HINT) : RESULT_HINT,
      done,
      answer: done ? outcome.answer : null,
    }))

    if (!done) {
      state.relaxed = []
      state.folded = []
      frames.push(snapshot(state, {
        ask: true,
        caption: `已定型 ${state.settled.length} / ${state.nodes.length}，候选还剩 ${candidates.length} 个。轮到你判断下一步。`,
        hint: DECISION_HINT,
      }))
    }
  }

  return frames
}

export function checkPick(frame, pick) {
  if (frame.done) return { ok: false, message: '已经结束了，没有下一步要判断。' }
  if (!frame.ask) return { ok: false, message: '现在没有要你决定的点。' }
  const node = frame.nodes.find((item) => item.id === pick)
  if (!node) return { ok: false, message: `没有这个点：${pick}` }
  if (node.settled) return { ok: false, message: `${node.label} 已经定型了 —— 每个点只取一次` }
  if (node.dist === null) return { ok: false, message: `${node.label} 的距离还是 ∞：从起点还没走到它，它不在候选里。` }

  const first = frame.candidates[0]
  if (pick !== first.id) {
    if (node.dist === first.dist) {
      return { ok: false, message: `${node.label} 和 ${labelForFrame(frame, first.id)} 都是距离 ${node.dist}，同一距离按下标小的 —— ${labelForFrame(frame, first.id)} 在前。` }
    }
    return { ok: false, message: `${node.label} 的距离是 ${node.dist}，${labelForFrame(frame, first.id)} 是 ${first.dist} —— 取距离最小的。` }
  }
  return { ok: true, message: '' }
}

function labelForFrame(frame, id) {
  return frame.nodes.find((node) => node.id === id)?.label ?? id
}
