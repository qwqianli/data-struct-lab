/**
 * 295 数据流的中位数 —— 两个 TreeCanvas 并排，`noScale` 的第一个真正用户。
 *
 * 模型：大顶堆存**较小的一半**（顶 = 左半最大），小顶堆存**较大的一半**（顶 = 右半最小）。
 * 不变量 |大顶| − |小顶| ∈ {0,1}；中位数 = 等长取两顶平均、不等取大顶顶。
 *
 * 判断题只有一个：新元素进哪个堆（x ≤ 大顶顶 → 大顶；否则小顶；大顶空 → 一律大顶）。
 * 搬移（rebalance）是维护不变量的机械补偿，属结果帧：用 edges 'path' 点亮搬移节点走过的链，
 * 不让用户点。clickable 全程 []。
 *
 * 帧结构沿用 215/347：f0 = 初始帧 + 第一问 riding；每个答案产 [结果帧, 下一问]，
 * 最后一问的答案产 [结果帧, 终局帧] —— A 1+5×2=11、B 1+6×2=13。
 *
 * 两棵树各自经 idxToDK(i) → slotId(d,k) 生成 cells，索引空间互不相干（都从 s0 起、不加前缀）；
 * marks 分两份（marksMax/marksMin）分别绑两个画布。帧字段给死：maxHeap/minHeap/median/done/moved。
 *
 * 范式同前七题：纯函数、答错静默跳过、判错归 checkPick；坐标只经 idxToDK/slotId。
 */
import { idxToDK, slotId } from '../../../core/tree-geom.js'

export const FIXTURE_A = { stream: [1, 3, 2, 5, 4] }
export const FIXTURE_B = { stream: [5, 2, 6, 1, 4, 3] }
export const DEFAULT_DATA = FIXTURE_A

const OPS = ['op-big', 'op-small']

// —— 大顶堆（存较小的一半）：parent ≥ 孩子 ——

function siftUpMax(h) {
  let i = h.length - 1
  const swaps = new Set()
  while (i > 0) {
    const p = (i - 1) >> 1
    if (h[p] >= h[i]) break
    ;[h[p], h[i]] = [h[i], h[p]]
    swaps.add(i)
    i = p
  }
  swaps.finalIdx = i
  return swaps
}

function siftDownMax(h) {
  let i = 0
  const swaps = new Set()
  for (;;) {
    const l = i * 2 + 1
    const r = l + 1
    let m = i
    if (l < h.length && h[l] > h[m]) m = l
    if (r < h.length && h[r] > h[m]) m = r
    if (m === i) break
    ;[h[i], h[m]] = [h[m], h[i]]
    swaps.add(m)
    i = m
  }
  swaps.finalIdx = i
  return swaps
}

// —— 小顶堆（存较大的一半）——

function siftUpMin(h) {
  let i = h.length - 1
  const swaps = new Set()
  while (i > 0) {
    const p = (i - 1) >> 1
    if (h[p] <= h[i]) break
    ;[h[p], h[i]] = [h[i], h[p]]
    swaps.add(i)
    i = p
  }
  swaps.finalIdx = i
  return swaps
}

function siftDownMin(h) {
  let i = 0
  const swaps = new Set()
  for (;;) {
    const l = i * 2 + 1
    const r = l + 1
    let m = i
    if (l < h.length && h[l] < h[m]) m = l
    if (r < h.length && h[r] < h[m]) m = r
    if (m === i) break
    ;[h[i], h[m]] = [h[m], h[i]]
    swaps.add(m)
    i = m
  }
  swaps.finalIdx = i
  return swaps
}

const heapLevels = (size) => (size === 0 ? 1 : Math.floor(Math.log2(size)) + 1)

/** 堆数组 → TreeCanvas 的 cells/edges（两个堆各调一次，索引空间互不相干） */
function canvasOf(heap, pathSet) {
  const cells = heap.map((v, i) => {
    const { d, k } = idxToDK(i)
    return { id: slotId(d, k), value: v, d, k, empty: false }
  })
  const edges = []
  for (let i = 1; i < heap.length; i += 1) {
    const p = idxToDK((i - 1) >> 1)
    const c = idxToDK(i)
    edges.push({
      from: slotId(p.d, p.k),
      to: slotId(c.d, c.k),
      kind: pathSet.has(i) ? 'path' : 'normal',
    })
  }
  return { cells, edges, levels: heapLevels(heap.length) }
}

const idAt = (heap, idx) => {
  const { d, k } = idxToDK(idx)
  return slotId(d, k)
}

const fmt = (m) => (m === null ? 'null' : String(m))

/**
 * 出一题。选项顺序按轮数轮转（第 1、3、5… 轮 [op-big, op-small]）。
 * label 只写判据、不出现当前元素与堆顶的具体数值。
 */
function makeAsk(x, maxHeap, round) {
  const base = OPS
  const rotated = base.map((_, i) => base[(i + round) % base.length])
  const labels = {
    'op-big': '放大顶堆（它 ≤ 大顶堆顶时）',
    'op-small': '放小顶堆（它 > 大顶堆顶时）',
  }
  const correct = maxHeap.length === 0 || x <= maxHeap[0] ? 'op-big' : 'op-small'
  return {
    prompt: `新元素 ${x} 该进哪个堆？`,
    options: rotated.map((pick) => ({ pick, label: labels[pick] })),
    correct,
    elementX: x,
    maxTop: maxHeap.length ? maxHeap[0] : null,
  }
}

function snapshot(state, { ask = null, caption, hint }) {
  return {
    maxTree: canvasOf(state.maxHeap, state.pathMax),
    minTree: canvasOf(state.minHeap, state.pathMin),
    marksMax: { ...state.marksMax },
    marksMin: { ...state.marksMin },
    maxHeap: [...state.maxHeap],
    minHeap: [...state.minHeap],
    median: state.median,
    moved: state.moved ? { ...state.moved } : null,
    cursor: state.cursor,
    clickable: [], // 判断题是「选进哪个堆」，不是点节点
    ask,
    done: state.done,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{stream?: number[], picks?: string[]}} options
 */
export function buildFrames({ stream = DEFAULT_DATA.stream, picks = [] } = {}) {
  if (!stream || stream.length === 0) {
    return [
      snapshot(
        {
          maxHeap: [],
          minHeap: [],
          pathMax: new Set(),
          pathMin: new Set(),
          marksMax: {},
          marksMin: {},
          median: null,
          moved: null,
          cursor: 0,
          done: true,
        },
        {
          caption: '空流：一个元素都没有，中位数为 null。',
          hint: '换一组数据再来练。',
        },
      ),
    ]
  }

  const state = {
    maxHeap: [],
    minHeap: [],
    pathMax: new Set(),
    pathMin: new Set(),
    marksMax: {},
    marksMin: {},
    median: null,
    moved: null,
    cursor: 0,
    done: false,
  }

  const marksFor = (heap, focus) => {
    const marks = {}
    heap.forEach((_, i) => {
      marks[idAt(heap, i)] = 'ok'
    })
    for (const i of focus) if (i < heap.length) marks[idAt(heap, i)] = 'active'
    return marks
  }

  const first = stream[0]
  let askCount = 0
  const frames = [
    snapshot(state, {
      ask: makeAsk(first, state.maxHeap, askCount++),
      caption: `数据流 [${stream.join('、')}] 共 ${stream.length} 个元素。大顶堆存较小的一半（顶 = 左半最大），小顶堆存较大的一半（顶 = 右半最小），|大顶| − |小顶| 恒在 {0,1}。第 1 个元素是 ${first} —— 它该怎么进？`,
      hint: '判据只有一条：新元素和大顶堆顶谁大（大顶堆还空着时不用比，直接进）。',
    }),
  ]

  for (const pick of picks) {
    if (state.done) break
    const x = stream[state.cursor]
    const correct = state.maxHeap.length === 0 || x <= state.maxHeap[0] ? 'op-big' : 'op-small'
    if (pick !== correct) continue // 答错静默跳过：不产帧，判错归 checkPick

    state.pathMax = new Set()
    state.pathMin = new Set()
    state.moved = null
    let focusMax = []
    let focusMin = []
    let caption

    if (correct === 'op-big') {
      const maxWasEmpty = state.maxHeap.length === 0
      state.maxHeap.push(x)
      const up = siftUpMax(state.maxHeap)
      for (const i of up) state.pathMax.add(i)
      focusMax = [up.finalIdx]
      caption = maxWasEmpty
        ? `大顶堆还空着，不用比 —— ${x} 直接进大顶堆。`
        : `${x} 进大顶堆（${x} ≤ 大顶顶）：`
    } else {
      state.minHeap.push(x)
      const up = siftUpMin(state.minHeap)
      for (const i of up) state.pathMin.add(i)
      focusMin = [up.finalIdx]
      caption = `${x} 进小顶堆（${x} > 大顶顶）：`
    }

    // 搬移（rebalance）：机械补偿，不让用户点；path 点亮搬移节点在两棵树里走过的链
    if (state.maxHeap.length - state.minHeap.length > 1) {
      const v = state.maxHeap[0]
      const last = state.maxHeap.pop()
      if (state.maxHeap.length) {
        state.maxHeap[0] = last
        state.pathMax = siftDownMax(state.maxHeap)
      }
      state.minHeap.push(v)
      const up = siftUpMin(state.minHeap)
      for (const i of up) state.pathMin.add(i)
      focusMin = [up.finalIdx]
      state.moved = { v, from: 'max' }
      caption += `两半失衡（|大顶|−|小顶| 超过 1），大顶堆顶 ${v} 搬去小顶 —— `
    } else if (state.minHeap.length - state.maxHeap.length > 0) {
      const v = state.minHeap[0]
      const last = state.minHeap.pop()
      if (state.minHeap.length) {
        state.minHeap[0] = last
        state.pathMin = siftDownMin(state.minHeap)
      }
      state.maxHeap.push(v)
      const up = siftUpMax(state.maxHeap)
      for (const i of up) state.pathMax.add(i)
      focusMax = [up.finalIdx]
      state.moved = { v, from: 'min' }
      caption += `两半失衡（小顶比大顶多），小顶堆顶 ${v} 搬去大顶 —— `
    }

    state.median =
      state.maxHeap.length === state.minHeap.length
        ? (state.maxHeap[0] + state.minHeap[0]) / 2
        : state.maxHeap[0]
    state.marksMax = marksFor(state.maxHeap, focusMax)
    state.marksMin = marksFor(state.minHeap, focusMin)
    caption += `大顶 [${state.maxHeap.join('、')}]、小顶 [${state.minHeap.join('、')}]，中位数 ${fmt(state.median)}。`
    if (state.moved) caption += (state.pathMax.size + state.pathMin.size) ? '搬移走过的路径已点亮。' : '（这一轮没有交换，堆形状不变）'

    state.cursor += 1
    const isLast = state.cursor >= stream.length

    frames.push(
      snapshot(state, {
        caption,
        hint: isLast
          ? '流走完了 —— 下一帧是终局。'
          : `下一个元素 ${stream[state.cursor]}：先和大顶顶比。`,
      }),
    )

    if (isLast) {
      state.done = true
      state.moved = null
      state.pathMax = new Set()
      state.pathMin = new Set()
      state.marksMax = marksFor(state.maxHeap, [])
      state.marksMin = marksFor(state.minHeap, [])
      frames.push(
        snapshot(state, {
          caption: `流走完：中位数 = ${fmt(state.median)}。大顶 [${state.maxHeap.join('、')}]（较小的一半）、小顶 [${state.minHeap.join('、')}]（较大的一半）—— 等长取两顶平均、不等取大顶顶。`,
          hint: '点「重来」再走一遍：这次每步先自己说出该进哪个堆、要不要搬移。',
        }),
      )
    } else {
      frames.push(
        snapshot(state, {
          ask: makeAsk(stream[state.cursor], state.maxHeap, askCount++),
          caption: `大顶 [${state.maxHeap.join('、')}]（顶 ${state.maxHeap[0]}）、小顶 [${state.minHeap.join('、')}]${state.minHeap.length ? `（顶 ${state.minHeap[0]}）` : ''}。下一个元素 ${stream[state.cursor]}：它和大顶顶谁大？`,
          hint: 'x ≤ 大顶顶 → 大顶堆；x > 大顶顶 → 小顶堆。放错了两半就串台。',
        }),
      )
    }
  }
  return frames
}

/**
 * 校验一次决策（进哪个堆）。判错文案必须点名当前元素与堆顶的真实数值：
 * 该进大顶却选小顶 → 「x ≤ 大顶顶 T —— 它属于较小的一半」；
 * 该进小顶却选大顶 → 「x > 大顶顶 T —— 它属于较大的一半」。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (!frame.ask) return { ok: false, message: '这一帧没有决策：按「继续」看两棵树的变化。' }
  if (!OPS.includes(pick)) return { ok: false, message: '这不是有效的操作：进大顶堆 / 进小顶堆。' }
  if (pick === frame.ask.correct) return { ok: true, message: '' }

  const x = frame.ask.elementX
  const top = frame.ask.maxTop
  if (frame.ask.correct === 'op-big') {
    return {
      ok: false,
      message:
        top === null
          ? `大顶堆还空着，不用比 —— ${x} 直接进大顶堆。`
          : `${x} ≤ 大顶顶 ${top} —— 它属于较小的一半，该进大顶堆；放进小顶堆两半就串台了。`,
    }
  }
  return {
    ok: false,
    message: `${x} > 大顶顶 ${top} —— 它属于较大的一半，该进小顶堆；塞进大顶堆会把左半的最大值顶错。`,
  }
}
