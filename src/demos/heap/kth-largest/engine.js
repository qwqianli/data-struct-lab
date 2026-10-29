/**
 * 215 数组中第 K 大的元素 —— TreeCanvas 第一次画「堆」。
 *
 * 堆 = 完全二叉树：数组下标 i 经 idxToDK(i) 直达槽位 (d,k)，父子 2i+1/2i+2 与槽位孩子完全吻合，
 * 所以零渲染器改动。大小 k 的小顶堆：堆里永远只留目前已见的最小 k 个，堆顶 = 当前的第 K 大。
 *
 * 交互是「选操作」不是「点节点」：clickable 全程 []，每读一个新元素 ask 一次 ——
 * 入堆（没满）/ 换顶（满且新 > 堆顶）/ 丢弃（满且新 ≤ 堆顶）。
 * 上浮/下沉是机械操作不让用户点（选较小孩子不是判断题），下沉路径用 edges 'path' 点亮。
 *
 * 帧结构（Structure T）：f0 = 初始帧（空堆 + 第一问 riding）；
 * 每个答案产 [结果帧, 下一问]；最后一问的答案产 [结果帧, 终局帧] ——
 * A = 1 + 6×2 = 13、B = 1 + 7×2 = 15。
 *
 * replace 的实现口径 = 弹出最小再压入新值（popMin → siftDown，再 push → siftUp），
 * 与任务书给死的轨迹逐格一致：A 的 [1,3,2] --换 5--> [2,3,5] --换 4--> [3,5,4]。
 *
 * 范式同前五题：纯函数、答错静默跳过、判错归 checkPick；坐标只经 idxToDK/slotId。
 */
import { idxToDK, slotId } from '../../../core/tree-geom.js'

export const FIXTURE_A = { nums: [2, 3, 1, 5, 0, 4], k: 3 }
export const FIXTURE_B = { nums: [9, 5, 8, 7, 3, 6, 4], k: 4 }
export const DEFAULT_DATA = FIXTURE_A

const OPS = ['op-push', 'op-replace', 'op-discard']

// —— 小顶堆（纯数组操作，sift 只在内部用）——

function siftUp(heap) {
  let i = heap.length - 1
  const swaps = new Set()
  while (i > 0) {
    const p = (i - 1) >> 1
    if (heap[p] <= heap[i]) break
    ;[heap[p], heap[i]] = [heap[i], heap[p]]
    swaps.add(i)
    i = p
  }
  swaps.finalIdx = i
  return swaps
}

function siftDown(heap) {
  let i = 0
  const swaps = new Set()
  for (;;) {
    const l = i * 2 + 1
    const r = l + 1
    let m = i
    if (l < heap.length && heap[l] < heap[m]) m = l
    if (r < heap.length && heap[r] < heap[m]) m = r
    if (m === i) break
    ;[heap[i], heap[m]] = [heap[m], heap[i]]
    swaps.add(m)
    i = m
  }
  swaps.finalIdx = i
  return swaps
}

const heapLevels = (size) => (size === 0 ? 1 : Math.floor(Math.log2(size)) + 1)

/** 堆数组 → TreeCanvas 的 cells/edges。pathSet 里是「child 下标」（path 边的 to 端） */
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
  return { cells, edges }
}

const topIdOf = (heap) => {
  if (!heap.length) return null
  const { d, k } = idxToDK(0)
  return slotId(d, k)
}

/**
 * 出一题。选项顺序按轮数轮转（照 reverse-list/engine.js 的 makeAsk(round)）。
 * label 只说「什么时候选它」，不替用户算当前元素和堆顶的大小关系。
 */
function makeAsk(element, heap, k, round) {
  const base = OPS
  const rotated = base.map((_, i) => base[(i + round) % base.length])
  const labels = {
    'op-push': `入堆：直接放进堆里（堆没满 ${k} 个时）`,
    'op-replace': `换顶：弹出最小、放入 ${element.v}（${element.v} 比堆顶大时）`,
    'op-discard': `丢弃：不要 ${element.v}（${element.v} ≤ 堆顶时）`,
  }
  const top = heap.length ? heap[0] : null
  const correct = heap.length < k ? 'op-push' : element.v > top ? 'op-replace' : 'op-discard'
  return {
    prompt: `新元素 ${element.v}（第 ${element.idx + 1} 个）：入堆 / 换顶 / 丢弃？`,
    options: rotated.map((pick) => ({ pick, label: labels[pick] })),
    correct,
    elementV: element.v,
    elementIdx: element.idx,
    heapTop: top,
    heapSize: heap.length,
  }
}

function snapshot(state, { ask = null, caption, hint }) {
  const pathSet = state.pathSet
  const { cells, edges } = canvasOf(state.heap, pathSet)
  return {
    cells,
    edges,
    pointers: [{ name: 'top', at: topIdOf(state.heap) }],
    marks: { ...state.marks },
    clickable: [], // 本题的决策是「选操作」不是「点节点」：全程无可点格子
    levels: heapLevels(state.heap.length),
    heap: [...state.heap],
    k: state.k,
    cursor: state.cursor,
    answer: state.answer,
    ask,
    done: state.done,
    caption,
    hint,
  }
}

const rejected = (caption) => [
  {
    cells: [],
    edges: [],
    pointers: [{ name: 'top', at: null }],
    marks: {},
    clickable: [],
    levels: 1,
    heap: [],
    k: 0,
    cursor: 0,
    answer: null,
    ask: null,
    done: true,
    caption,
    hint: '换一组数据再来练。',
  },
]

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], k?: number, picks?: string[]}} options
 */
export function buildFrames({ nums = DEFAULT_DATA.nums, k = DEFAULT_DATA.k, picks = [] } = {}) {
  if (!nums || nums.length === 0) return rejected('空数组没有第 K 大。')
  if (k > nums.length) return rejected(`k = ${k} 比数组长度 ${nums.length} 还大：没有第 ${k} 大。`)

  const state = {
    heap: [],
    k,
    cursor: 0, // 待处理元素下标
    marks: {},
    pathSet: new Set(),
    answer: null,
    done: false,
  }

  const first = nums[0]
  let askCount = 0
  const frames = [
    snapshot(state, {
      ask: makeAsk({ v: first, idx: 0 }, state.heap, k, askCount++),
      caption: `大小 ${k} 的小顶堆：堆里只留目前见过的最小 ${k} 个，堆顶 = 当前的第 ${k} 大。数组 [${nums.join('、')}] 共 ${nums.length} 个元素 —— 第 1 个是 ${first}，它该怎么处理？`,
      hint: '判断只看一件事：新元素和堆顶谁大（堆没满时不用比，直接进）。',
    }),
  ]

  const marksFor = (activeIdx) => {
    const marks = {}
    state.heap.forEach((_, i) => {
      marks[slotId(idxToDK(i))] = 'ok'
    })
    if (activeIdx !== null && activeIdx < state.heap.length) marks[slotId(idxToDK(activeIdx))] = 'active'
    return marks
  }

  for (const pick of picks) {
    if (state.done) break
    const idx = state.cursor
    const v = nums[idx]
    const ask = makeAsk({ v, idx }, state.heap, k, 0) // 只为取 correct（轮转以 askCount 为准，不重复计数）
    const correct = ask.correct

    if (pick !== correct) continue // 答错静默跳过：不产帧，判错归 checkPick

    let caption
    if (correct === 'op-push') {
      state.heap.push(v)
      const swaps = siftUp(state.heap)
      state.pathSet = swaps
      state.marks = marksFor(swaps.finalIdx)
      caption = `入堆 ${v}：堆 = [${state.heap.join('、')}]（${state.heap.length}/${k}），堆顶 ${state.heap[0]}。${
        swaps.size ? '上浮路径已点亮。' : '（这一轮没有交换，堆形状不变）'
      }`
    } else if (correct === 'op-replace') {
      const oldTop = state.heap[0]
      const last = state.heap.pop()
      state.pathSet = new Set()
      if (state.heap.length) {
        state.heap[0] = last
        state.pathSet = siftDown(state.heap)
      }
      state.heap.push(v)
      const upSwaps = siftUp(state.heap)
      for (const i of upSwaps) state.pathSet.add(i)
      state.marks = marksFor(upSwaps.finalIdx)
      caption = `换顶：弹出 ${oldTop}、放入 ${v} → [${state.heap.join('、')}]，堆顶 ${state.heap[0]}。${state.pathSet.size ? '弹出和上浮走过的路径已点亮。' : '（这一轮没有交换，堆形状不变）'}`
    } else {
      state.pathSet = new Set()
      state.marks = marksFor(0) // 丢弃：堆不动，堆顶保持焦点
      caption = `丢弃 ${v}：${v} ≤ 堆顶 ${state.heap[0]}，堆不动 = [${state.heap.join('、')}]。`
    }
    state.cursor += 1
    const isLast = state.cursor >= nums.length

    frames.push(
      snapshot(state, {
        caption,
        hint: isLast
          ? '数组走完了 —— 下一帧是终局。'
          : `堆里现在 ${state.heap.length}/${k} 个。下一个元素 ${nums[state.cursor]}：先比堆顶。`,
      }),
    )

    if (isLast) {
      // 终局帧：清场（全 ok、无路径），先置位 done 再快照
      state.answer = state.heap[0]
      state.done = true
      state.marks = marksFor(null)
      state.pathSet = new Set()
      frames.push(
        snapshot(state, {
          caption: `数组走完：第 ${k} 大 = 堆顶 ${state.heap[0]}。堆里留着最小的 ${k} 个：[${state.heap.join('、')}] —— 每一步只做对一个判断：新元素和堆顶谁大。`,
          hint: '点「重来」再走一遍：这次先自己报出每一步该入堆、换顶还是丢弃。',
        }),
      )
    } else {
      const next = nums[state.cursor]
      frames.push(
        snapshot(state, {
          ask: makeAsk({ v: next, idx: state.cursor }, state.heap, k, askCount++),
          caption: `堆 = [${state.heap.join('、')}]（${state.heap.length}/${k}），堆顶 ${state.heap[0]}。下一个元素 ${next}（第 ${state.cursor + 1}/${nums.length} 个）：它和堆顶谁大？`,
          hint: '满 k 个之后，进堆的门槛就是堆顶：比堆顶大才配换掉它。',
        }),
      )
    }
  }
  return frames
}

/**
 * 校验一次操作选择。三类反馈（文案里的数来自当前帧）：
 * 该换顶却丢弃：「X 比堆顶 Y 大，丢掉就漏了第 K 大」；
 * 该丢弃却换顶：「X 比堆顶 Y 小，换进来会把答案挤掉」；
 * 堆没满就换顶/丢弃：「堆还没满 k 个，先装满」。另有满堆入堆的兜底。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (!frame.ask) return { ok: false, message: '这一帧没有决策：按「继续」看堆的变化。' }
  if (!OPS.includes(pick)) return { ok: false, message: '这不是有效的操作：入堆 / 换顶 / 丢弃。' }
  if (pick === frame.ask.correct) return { ok: true, message: '' }

  const v = frame.ask.elementV
  const top = frame.ask.heapTop
  const size = frame.ask.heapSize
  const k = frame.k

  if (frame.ask.correct === 'op-push') {
    return {
      ok: false,
      message: `堆还没满 ${k} 个（现在 ${size} 个），先装满 —— ${v} 直接放进去就行，不用和堆顶比。`,
    }
  }
  if (frame.ask.correct === 'op-replace') {
    if (pick === 'op-discard') {
      return { ok: false, message: `${v} 比堆顶 ${top} 大，丢掉就漏了第 ${k} 大 —— 它该把 ${top} 换下去。` }
    }
    return {
      ok: false,
      message: `堆已经满 ${k} 个了，不能再入堆：${v} 比堆顶 ${top} 大，该换顶（弹出 ${top}、放入 ${v}）。`,
    }
  }
  if (pick === 'op-replace') {
    return { ok: false, message: `${v} 比堆顶 ${top} 小，换进来会把答案挤掉 —— 第 ${k} 大只会变得更小。` }
  }
  return { ok: false, message: `堆已经满 ${k} 个了：${v} ≤ 堆顶 ${top}，丢掉它。` }
}
