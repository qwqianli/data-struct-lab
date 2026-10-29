export const FIXTURE_A = {
  nodes: [
    { id: 'c0', label: 'C0', x: 70, y: 60 },
    { id: 'c1', label: 'C1', x: 70, y: 200 },
    { id: 'c2', label: 'C2', x: 230, y: 130 },
    { id: 'c3', label: 'C3', x: 390, y: 40 },
    { id: 'c4', label: 'C4', x: 390, y: 220 },
    { id: 'c5', label: 'C5', x: 560, y: 130 },
  ],
  edges: [
    { id: 'c0>c2', from: 'c0', to: 'c2' },
    { id: 'c1>c2', from: 'c1', to: 'c2' },
    { id: 'c2>c3', from: 'c2', to: 'c3' },
    { id: 'c2>c4', from: 'c2', to: 'c4' },
    { id: 'c1>c4', from: 'c1', to: 'c4' },
    { id: 'c3>c5', from: 'c3', to: 'c5' },
    { id: 'c4>c5', from: 'c4', to: 'c5' },
  ],
}

export const FIXTURE_B = {
  nodes: [
    { id: 'c0', label: 'C0', x: 70, y: 60 },
    { id: 'c1', label: 'C1', x: 70, y: 200 },
    { id: 'c2', label: 'C2', x: 230, y: 130 },
    { id: 'c3', label: 'C3', x: 390, y: 130 },
    { id: 'c4', label: 'C4', x: 530, y: 50 },
    { id: 'c5', label: 'C5', x: 530, y: 210 },
  ],
  edges: [
    { id: 'c0>c2', from: 'c0', to: 'c2' },
    { id: 'c1>c2', from: 'c1', to: 'c2' },
    { id: 'c2>c3', from: 'c2', to: 'c3' },
    { id: 'c3>c4', from: 'c3', to: 'c4' },
    { id: 'c4>c5', from: 'c4', to: 'c5' },
    { id: 'c5>c3', from: 'c5', to: 'c3' },
  ],
}

export const DEFAULT_DATA = FIXTURE_A

const DECISION_HINT = '入度为 0 的才能剥；同为零入度时，下标小的先剥。'
const RESULT_HINT = '下一步还是只能从入度为 0 的课里挑。'
const DAG_HINT = '每门课都被剥过一次 —— 说明没有环，207 的答案是 true。'
const CYCLE_HINT = '剩下的课入度都 ≥ 1 —— 拓扑排序剥不动，就是有环。'

function makeState(data) {
  const nodes = data.nodes.map((node) => ({ ...node }))
  const edges = data.edges.map((edge) => ({ ...edge }))
  const inDeg = Object.fromEntries(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) inDeg[edge.to] += 1
  return {
    nodes,
    edges,
    inDeg,
    peeled: [],
    activeId: null,
    thawed: [],
    auto: [],
    cursor: 0,
  }
}

function labelFor(state, id) {
  return state.nodes.find((node) => node.id === id)?.label ?? id
}

function remainingOf(state) {
  const peeled = new Set(state.peeled)
  return state.nodes.filter((node) => !peeled.has(node.id)).map((node) => node.id)
}

function readyOf(state) {
  const remaining = new Set(remainingOf(state))
  return state.nodes
    .filter((node) => remaining.has(node.id) && state.inDeg[node.id] === 0)
    .map((node) => node.id)
}

function snapshot(state, { caption, hint, done = false, cycle = false, ask = false } = {}) {
  const remaining = remainingOf(state)
  const remainingSet = new Set(remaining)
  const ready = readyOf(state)
  const marks = {}
  for (const id of state.peeled) marks[id] = id === state.activeId ? 'active' : 'ok'
  if (cycle) for (const id of remaining) marks[id] = 'stuck'

  return {
    nodes: state.nodes.map((node) => ({
      ...node,
      inDeg: state.inDeg[node.id],
      peeled: state.peeled.includes(node.id),
    })),
    edges: state.edges.map((edge) => ({ ...edge })),
    marks,
    inDeg: { ...state.inDeg },
    remaining,
    peeled: [...state.peeled],
    ready,
    thawed: state.thawed.map((item) => ({ ...item })),
    auto: [...state.auto],
    cursor: state.cursor,
    ask: ask ? {
      prompt: '下一步剥哪一门？',
      options: remaining.map((id) => ({ pick: id, label: labelFor(state, id) })),
      correct: ready[0],
    } : null,
    caption,
    hint,
    done,
    cycle,
    clickable: [],
  }
}

function peel(state, id, { automatic = false } = {}) {
  state.peeled.push(id)
  state.activeId = id
  state.inDeg[id] = 0
  if (automatic) state.auto.push(id)
  const remaining = new Set(remainingOf(state))
  for (const edge of state.edges) {
    if (edge.from !== id || !remaining.has(edge.to)) continue
    const before = state.inDeg[edge.to]
    state.inDeg[edge.to] -= 1
    state.thawed.push({ id: edge.to, from: before, to: state.inDeg[edge.to] })
  }
}

function resultCaption(state, pickedId, { autoId = null, dag = false } = {}) {
  const picked = labelFor(state, pickedId)
  const thawText = state.thawed.map(({ id, from, to }) => `${labelFor(state, id)} 入度 ${from} → ${to}`).join('，')
  let caption = thawText
    ? `剥下 ${picked}：${thawText}。`
    : `剥下 ${picked}：它没有指向剩余课的先修边。`
  if (autoId) {
    caption += `只剩 ${labelFor(state, autoId)}（入度 0），一并剥下 —— ${state.nodes.length} 门课全部剥完，无环。`
  } else if (dag) {
    caption += ` —— ${state.nodes.length} 门课全部剥完，无环。`
  } else {
    caption += `还剩 ${remainingOf(state).length} 门。`
  }
  return caption
}

function cycleCaption(state) {
  const names = remainingOf(state).map((id) => labelFor(state, id)).join('、')
  return `剩下的 ${names} 入度都不是 0 —— 它们互相等着，成了环。207 的答案是 false。`
}

function openingCycleCaption(state) {
  return `${state.nodes.length} 门课，没有一门入度为 0 —— 从谁开始都等不到，直接就是环。207 的答案是 false。`
}

export function buildFrames({ data = DEFAULT_DATA, picks = [] } = {}) {
  const state = makeState(data)
  const frames = []
  const initialReady = readyOf(state)
  if (!initialReady.length) {
    frames.push(snapshot(state, {
      caption: openingCycleCaption(state),
      hint: CYCLE_HINT,
      done: true,
      cycle: true,
    }))
    return frames
  }

  frames.push(snapshot(state, {
    caption: `${state.nodes.length} 门课，${state.edges.length} 条先修边。箭头从先修课指向后修课，圆圈左上角小圈里的数字是这门课此刻还欠几门前置。还没剥掉任何一门。`,
    hint: DECISION_HINT,
    ask: true,
  }))

  for (const pick of picks) {
    const decision = frames.at(-1)
    if (!decision.ask || decision.done) break
    if (!checkPick(decision, pick).ok) continue

    state.thawed = []
    state.auto = []
    state.cursor += 1
    peel(state, pick)

    let autoId = null
    const afterPickRemaining = remainingOf(state)
    if (afterPickRemaining.length === 1 && state.inDeg[afterPickRemaining[0]] === 0) {
      autoId = afterPickRemaining[0]
      peel(state, autoId, { automatic: true })
    }

    let frame
    const remaining = remainingOf(state)
    if (!remaining.length) {
      frame = snapshot(state, {
        caption: resultCaption(state, pick, { autoId, dag: true }),
        hint: DAG_HINT,
        done: true,
        cycle: false,
      })
      frames.push(frame)
      continue
    }

    frame = snapshot(state, {
      caption: resultCaption(state, pick),
      hint: RESULT_HINT,
    })
    frames.push(frame)
    state.thawed = []

    const ready = readyOf(state)
    if (!ready.length) {
      frames.push(snapshot(state, {
        caption: cycleCaption(state),
        hint: CYCLE_HINT,
        done: true,
        cycle: true,
      }))
      continue
    }

    frames.push(snapshot(state, {
      caption: `已剥 ${state.peeled.length} 门，还剩 ${remaining.length} 门。轮到你判断下一步。`,
      hint: DECISION_HINT,
      ask: true,
    }))
  }

  return frames
}

export function checkPick(frame, pick) {
  if (frame.done) return { ok: false, message: '已经结束了，没有下一步要判断。' }
  if (!frame.ask) return { ok: false, message: '现在没有要你决定的事。' }
  const node = frame.nodes.find((item) => item.id === pick)
  if (!node) return { ok: false, message: `没有这门课：${pick}` }
  if (node.peeled) return { ok: false, message: `${node.label} 已经剥过了 —— 每门课只剥一次` }
  const degree = frame.inDeg[pick]
  if (degree > 0) {
    const remaining = new Set(frame.remaining)
    const waiting = [...new Set(frame.edges
      .filter((edge) => edge.to === pick && remaining.has(edge.from))
      .map((edge) => frame.nodes.find((item) => item.id === edge.from)?.label ?? edge.from))]
    return { ok: false, message: `${node.label} 的入度还有 ${degree}：还等着 ${waiting.join('、')}。入度归 0 才能剥。` }
  }
  if (pick !== frame.ready[0]) {
    const first = frame.nodes.find((item) => item.id === frame.ready[0])
    return { ok: false, message: `${node.label} 也确实入度为 0，但同为零入度时按下标最小优先 —— ${first.label} 在前。` }
  }
  return { ok: true, message: '' }
}
