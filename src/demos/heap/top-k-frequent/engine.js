/**
 * 347 前 K 个高频元素 —— 两个画布的第一次联动：HashCanvas 数频率 + TreeCanvas 取前 K。
 *
 * 题眼：排序不是必须的 —— 数完频率，用大小 k 的小顶堆（比较键 = 频率）扫一遍不同值就够。
 * 堆里留频率最高的 k 个，堆顶 = 第 k 高的频率；答案 = 堆内元素按频率降序。
 *
 * 分两段：第一段统计（机械动作，1 帧给全 —— 不让用户一个个数）；
 * 第二段按「值首次出现的顺序」过每个不同的值，每值一轮 2 帧（决策 ask + 结果）。
 * 帧结构沿用 215 的 Structure T：f0 初始、f1 统计帧 + 第一问 riding；
 * 每个答案产 [结果帧, 下一问]，最后一问的答案产 [结果帧, 终局帧] —— A 1+1+5×2=12、B 1+1+3×2=8。
 *
 * 堆按频率比大小（215 的数值比较换成频率比较），picks 词汇与 checkPick 三类反馈同构；
 * cells 值只放元素值、频率进 caption（格子里不塞两个数）。
 * HashCanvas 契约：capacity = 不同值个数，buckets[v % capacity] 一项 {id:'k'+v, key:String(v), value:String(freq)}。
 *
 * 范式同前六题：纯函数、答错静默跳过、判错归 checkPick；坐标只经 idxToDK/slotId。
 */
import { idxToDK, slotId } from '../../../core/tree-geom.js'

export const FIXTURE_A = { nums: [1, 1, 1, 2, 2, 3, 4, 5, 5, 5, 5, 5], k: 3 }
export const FIXTURE_B = { nums: [1, 1, 2, 3, 3, 3], k: 2 }
export const DEFAULT_DATA = FIXTURE_A

const OPS = ['op-push', 'op-replace', 'op-discard']

// —— 频率统计（第一段，1 帧给全）——

/** 频率表 + 不同值按首次出现排序 */
function countFreqs(nums) {
  const freq = new Map()
  for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1)
  return {
    freq,
    distinct: [...freq.keys()], // Map 保持插入序 = 首次出现序
  }
}

/** HashCanvas 的 buckets：每值一项，放进 v % capacity 号桶 */
function hashOf(freq, capacity) {
  const buckets = Array.from({ length: capacity }, () => [])
  for (const [v, f] of freq) {
    buckets[v % capacity].push({ id: `k${v}`, key: String(v), value: String(f) })
  }
  return { capacity, buckets }
}

// —— 小顶堆（按频率），元素 { v, f } ——

function siftUp(heap) {
  let i = heap.length - 1
  while (i > 0) {
    const p = (i - 1) >> 1
    if (heap[p].f <= heap[i].f) break
    ;[heap[p], heap[i]] = [heap[i], heap[p]]
    i = p
  }
  return i
}

function siftDown(heap) {
  let i = 0
  for (;;) {
    const l = i * 2 + 1
    const r = l + 1
    let m = i
    if (l < heap.length && heap[l].f < heap[m].f) m = l
    if (r < heap.length && heap[r].f < heap[m].f) m = r
    if (m === i) break
    ;[heap[i], heap[m]] = [heap[m], heap[i]]
    i = m
  }
  return i
}

/** 终点下标的祖先链（root→终点），作为 path 边的 child 下标集合 */
function chainSet(finalIdx) {
  const set = new Set()
  for (let i = finalIdx; i > 0; i = (i - 1) >> 1) set.add(i)
  return set
}

const heapLevels = (size) => (size === 0 ? 1 : Math.floor(Math.log2(size)) + 1)

/** 堆数组 → TreeCanvas 的 cells/edges。cells 值只放元素值，频率走 caption */
function canvasOf(heap, pathSet) {
  const cells = heap.map((item, i) => {
    const { d, k } = idxToDK(i)
    return { id: slotId(d, k), value: item.v, d, k, empty: false }
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

const heapText = (heap) => heap.map((h) => `${h.v}(${h.f})`).join('、')

/**
 * 出一题。选项顺序按轮数轮转（照 reverse-list/engine.js 的 makeAsk(round)）。
 * label 只说「什么时候选它」，不替用户算当前频率和堆顶频率谁高。
 */
function makeAsk(v, f, heap, k, round) {
  const base = OPS
  const rotated = base.map((_, i) => base[(i + round) % base.length])
  const labels = {
    'op-push': `入堆：直接放进堆里（堆没满 ${k} 个时）`,
    'op-replace': `换顶：弹出堆顶（${v} 的频率比堆顶高时）`,
    'op-discard': `丢弃：不要 ${v}（${v} 的频率不高于堆顶时）`,
  }
  const top = heap.length ? heap[0] : null
  const correct = heap.length < k ? 'op-push' : f > top.f ? 'op-replace' : 'op-discard'
  return {
    prompt: `值 ${v} 出现 ${f} 次：入堆 / 换顶 / 丢弃？`,
    options: rotated.map((pick) => ({ pick, label: labels[pick] })),
    correct,
    elementV: v,
    elementF: f,
    topV: top ? top.v : null,
    topF: top ? top.f : null,
    heapSize: heap.length,
  }
}

function snapshot(state, { ask = null, caption, hint }) {
  const { cells, edges } = canvasOf(state.heap, state.pathSet)
  return {
    hash: state.hash, // { capacity, buckets } —— 左侧频率表，全程在场
    cells,
    edges,
    pointers: [{ name: 'top', at: topIdOf(state.heap) }],
    marks: { ...state.marks },
    clickable: [], // 决策是「选操作」不是「点节点」
    levels: heapLevels(state.heap.length),
    heap: state.heap.map((h) => ({ ...h })), // [{ v, f }] 堆数组（按频率的小顶堆）
    k: state.k,
    cursor: state.cursor,
    answer: state.answer,
    ask,
    done: state.done,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], k?: number, picks?: string[]}} options
 */
export function buildFrames({ nums = DEFAULT_DATA.nums, k = DEFAULT_DATA.k, picks = [] } = {}) {
  if (!nums || nums.length === 0) {
    return [
      snapshot(
        {
          hash: { capacity: 1, buckets: [[]] },
          heap: [],
          k,
          cursor: 0,
          marks: {},
          pathSet: new Set(),
          answer: [],
          done: true,
        },
        {
          caption: '空数组：没有任何元素，前 K 高频为空 []。',
          hint: '换一组数据再来练。',
        },
      ),
    ]
  }

  const { freq, distinct } = countFreqs(nums)
  const capacity = distinct.length
  const hash = hashOf(freq, capacity)
  const freqText = distinct.map((v) => `${v} 出现 ${freq.get(v)} 次`).join('、')

  const state = {
    hash: { capacity, buckets: Array.from({ length: capacity }, () => []) }, // f0：还没数，空桶
    heap: [],
    k,
    cursor: 0, // distinct 下标（按首次出现序）
    marks: {},
    pathSet: new Set(),
    answer: null,
    done: false,
  }

  const marksFor = (activeIdx) => {
    const marks = {}
    state.heap.forEach((_, i) => {
      marks[slotId(idxToDK(i))] = 'ok'
    })
    if (activeIdx !== null && activeIdx < state.heap.length) marks[slotId(idxToDK(activeIdx))] = 'active'
    return marks
  }

  // f0：初始（数组 + 提示「先数频率」）；f1：统计帧 + 第一问 riding
  let askCount = 0
  const first = distinct[0]
  const frames = [
    snapshot(state, {
      caption: `数组 [${nums.join('、')}] 共 ${nums.length} 个元素、${capacity} 个不同的值。第一步数频率 —— 机械动作，下一帧直接给全；第二步才是判断题：按首次出现的顺序过每个值，决定它进不进大小 ${k} 的小顶堆（比较键 = 频率）。`,
      hint: '堆里只留频率最高的 k 个，堆顶 = 第 k 高的频率 —— 全程不需要排序。',
    }),
  ]
  state.cursor = 0
  state.hash = hash // 统计帧：一次给全
  frames.push(
    snapshot(state, {
      ask: makeAsk(first, freq.get(first), state.heap, k, askCount++),
      caption: `频率数完：${freqText}（左侧哈希表，桶号 = 值 % ${capacity}）。现在按首次出现的顺序过每个值 —— 第一个是 ${first}（${freq.get(first)} 次）：它该怎么处理？`,
      hint: '堆没满时不用比频率，直接进；满了之后门槛就是堆顶的频率。',
    }),
  )

  for (const pick of picks) {
    if (state.done) break
    const v = distinct[state.cursor]
    const f = freq.get(v)
    const correct = state.heap.length < k ? 'op-push' : f > state.heap[0].f ? 'op-replace' : 'op-discard'

    if (pick !== correct) continue // 答错静默跳过：不产帧，判错归 checkPick

    let caption
    if (correct === 'op-push') {
      state.heap.push({ v, f })
      const finalIdx = siftUp(state.heap)
      state.pathSet = chainSet(finalIdx)
      state.marks = marksFor(finalIdx)
      caption = `入堆 ${v}（${f} 次）：堆 = [${heapText(state.heap)}]（${state.heap.length}/${k}），堆顶 ${state.heap[0].v}（${state.heap[0].f} 次）。${
        finalIdx === state.heap.length - 1 ? '父节点频率不高于它，没上浮。' : '上浮路径已点亮。'
      }`
    } else if (correct === 'op-replace') {
      const oldTop = state.heap[0]
      const last = state.heap.pop()
      if (state.heap.length) {
        state.heap[0] = last
        const downIdx = siftDown(state.heap)
        state.pathSet = chainSet(downIdx)
      }
      state.heap.push({ v, f })
      const upIdx = siftUp(state.heap)
      for (const i of chainSet(upIdx)) state.pathSet.add(i)
      state.marks = marksFor(upIdx)
      caption = `换顶：弹出 ${oldTop.v}（${oldTop.f} 次）、放入 ${v}（${f} 次）→ [${heapText(state.heap)}]，堆顶 ${state.heap[0].v}（${state.heap[0].f} 次）。弹出和上浮走过的路径都已点亮。`
    } else {
      state.pathSet = new Set()
      state.marks = marksFor(0) // 丢弃：堆不动，堆顶保持焦点
      caption = `丢弃 ${v}（${f} 次）：${f} ≤ 堆顶 ${state.heap[0].v} 的 ${state.heap[0].f} 次，堆不动 = [${heapText(state.heap)}]。`
    }
    state.cursor += 1
    const isLast = state.cursor >= distinct.length

    frames.push(
      snapshot(state, {
        caption,
        hint: isLast ? '不同值走完了 —— 下一帧是终局。' : `堆里现在 ${state.heap.length}/${k} 个。下一个值 ${distinct[state.cursor]}（${freq.get(distinct[state.cursor])} 次）：先比堆顶频率。`,
      }),
    )

    if (isLast) {
      // 终局帧：清场（全 ok、无路径），先置位 done 再快照
      state.answer = [...state.heap].sort((a, b) => b.f - a.f || distinct.indexOf(a.v) - distinct.indexOf(b.v)).map((h) => h.v)
      state.done = true
      state.marks = marksFor(null)
      state.pathSet = new Set()
      frames.push(
        snapshot(state, {
          caption: `走完：前 ${k} 高频 = [${state.answer.join('、')}]。堆里留着频率最高的 ${state.heap.length} 个：[${heapText(state.heap)}] —— 排序不是必须的：数完频率、大小 ${k} 的堆扫一遍就够。`,
          hint: '点「重来」再走一遍：这次每一步先自己报出该入堆、换顶还是丢弃。',
        }),
      )
    } else {
      const next = distinct[state.cursor]
      frames.push(
        snapshot(state, {
          ask: makeAsk(next, freq.get(next), state.heap, k, askCount++),
          caption: `堆 = [${heapText(state.heap)}]（${state.heap.length}/${k}），堆顶 ${state.heap[0].v}（${state.heap[0].f} 次）。下一个值 ${next}（${freq.get(next)} 次）：频率谁高？`,
          hint: '满 k 个之后，进堆的门槛就是堆顶的频率：比它高才配换掉它。',
        }),
      )
    }
  }
  return frames
}

/**
 * 校验一次操作选择（与 215 同构，数值比较换成频率比较）。三类反馈：
 * 该换顶却丢弃：「X 出现 n 次，比堆顶 Y 的 m 次多，丢掉就漏了」；
 * 该丢弃却换顶：「X 只出现 n 次，换进来会把堆顶 Y 挤掉」；
 * 堆没满就换顶/丢弃：「堆还没满 k 个，先装满」。另有满堆入堆的兜底。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (!frame.ask) return { ok: false, message: '这一帧没有决策：按「继续」看堆的变化。' }
  if (!OPS.includes(pick)) return { ok: false, message: '这不是有效的操作：入堆 / 换顶 / 丢弃。' }
  if (pick === frame.ask.correct) return { ok: true, message: '' }

  const v = frame.ask.elementV
  const f = frame.ask.elementF
  const topV = frame.ask.topV
  const topF = frame.ask.topF
  const size = frame.ask.heapSize
  const k = frame.k

  if (frame.ask.correct === 'op-push') {
    return {
      ok: false,
      message: `堆还没满 ${k} 个（现在 ${size} 个），先装满 —— ${v} 出现 ${f} 次，直接放进去就行，不用和堆顶比。`,
    }
  }
  if (frame.ask.correct === 'op-replace') {
    if (pick === 'op-discard') {
      return { ok: false, message: `${v} 出现 ${f} 次，比堆顶 ${topV} 的 ${topF} 次多，丢掉就漏了 —— 它该把 ${topV} 换下去。` }
    }
    return {
      ok: false,
      message: `堆已经满 ${k} 个了，不能再入堆：${v} 出现 ${f} 次，比堆顶 ${topV} 的 ${topF} 次多，该换顶（弹出 ${topV}、放入 ${v}）。`,
    }
  }
  if (pick === 'op-replace') {
    return { ok: false, message: `${v} 只出现 ${f} 次，换进来会把堆顶 ${topV} 挤掉 —— ${topV} 的频率 ${topF} 不比它低，换了白换。` }
  }
  return { ok: false, message: `堆已经满 ${k} 个了：${v} 出现 ${f} 次，不高于堆顶 ${topV} 的 ${topF} 次，丢掉它。` }
}
