/**
 * 102 二叉树的层序遍历 —— TreeCanvas 的第二个使用者（证明它不是只为中序定制）。
 *
 * 纯点击题：picks 词汇只有格子 id（s0…s14）。
 * 题眼：正解 = 队首。每轮出队队首，其两个孩子（若存在）入队；
 * 本层还有未出队时队首是本层最左那个，本层出完时换成下一层第一个 ——
 * 这一轮换就是「一层什么时候结束」。
 *
 * 层序按 (d,k) 排，不照搬 94 的 walkOrder（全格 x 升序是中序专用的几何事实）。
 * 坐标零字面量：格子定位全部经 slotId/slotX（渲染层），引擎只 import slotId。
 *
 * 范式同 94：纯函数、无 Vue；答错的 pick 在 buildFrames 里静默跳过（深链安全复放），
 * 判错归 checkPick；空数据必须出 1 帧且 done:true。
 */
import { slotId } from '../../../core/tree-geom.js'

export const FIXTURE_A = [3, 9, 20, null, null, 15, 7]
export const FIXTURE_B = [1, 2, 3, 4, 5, 6, 7, 8]
export const DEFAULT_NUMS = FIXTURE_A

const MAX_LEVELS = 4 // 深度硬锁：真实深度 ≤ 4，5 层热区只剩 ≈43px

/**
 * LeetCode 层序解析（与 94 同一口径）：BFS 队列分配、不是堆下标填充 ——
 * 按队列顺序给每个真实节点分配左右孩子；null 只占位不入队；数组提前结束 = 剩余孩子为 null。
 * 空格只画「真实父节点的缺失孩子」且不在第 L 层；空格自己不生孩子。
 * 本题两组 fixture 的空格都落在 d = L（A 的 s3/s4、B 各缺失槽），全都不画 —— 空格列表恒为 []。
 */
function parse(nums) {
  if (!nums || nums.length === 0) return { cells: [], levels: 0 }

  const root = { id: slotId(1, 0), value: nums[0], d: 1, k: 0, empty: false }
  const cells = [root]
  const queue = [root]
  let i = 1
  while (queue.length > 0 && i < nums.length) {
    const node = queue.shift()
    for (const side of [0, 1]) {
      if (i >= nums.length) break
      const v = nums[i++]
      const d = node.d + 1
      const k = node.k * 2 + side
      if (v === null) {
        cells.push({ id: slotId(d, k), value: null, d, k, empty: true })
      } else {
        const child = { id: slotId(d, k), value: v, d, k, empty: false }
        cells.push(child)
        queue.push(child)
      }
    }
  }

  const levels = cells.reduce((m, c) => (c.empty ? m : Math.max(m, c.d)), 0)
  const kept = cells.filter((c) => !c.empty || c.d < levels)
  return { cells: kept, levels }
}

/** 画出来的真实孩子（空格不入队；d=L 的孩子槽不画） */
function childrenOf(cell, cellsById) {
  const ids = [slotId(cell.d + 1, cell.k * 2), slotId(cell.d + 1, cell.k * 2 + 1)]
  return ids.map((id) => cellsById[id]).filter((c) => c && !c.empty)
}

/**
 * clickable = 当前层未出队 ∪ 下一层第一个（都已在队列里，按入队顺序）。
 * 留下一层第一个可点，是为了让「提前越层」错得出来（否则只剩照做）。
 * 队列里层号最多差 1（出队 cl 层、孩子只进 cl+1 层），min 层就是当前层。
 */
function clickableOf(queue, cellsById) {
  if (queue.length === 0) return []
  const curLayer = cellsById[queue[0]].d
  const cur = queue.filter((id) => cellsById[id].d === curLayer)
  const nextFirst = queue.find((id) => cellsById[id].d === curLayer + 1)
  return nextFirst ? [...cur, nextFirst] : cur
}

/**
 * 结构边表：每个非根格子一条指向它的边。
 * kind：'path' = 本轮刚出队节点的孩子边（孩子进下一行，渲染器改色加粗）；
 * 'null' = 指向空格；其余 'normal'。
 */
function edgesFor(pathFrom, pathToSet, cells) {
  const edges = []
  for (const c of cells) {
    if (c.d === 1) continue
    const parentId = slotId(c.d - 1, Math.floor(c.k / 2))
    let kind = c.empty ? 'null' : 'normal'
    if (!c.empty && pathToSet.has(c.id) && parentId === pathFrom) kind = 'path'
    edges.push({ from: parentId, to: c.id, kind })
  }
  return edges
}

const descOf = (c) => `${c.value}（${c.id}）`

function snapshot(state, { caption, hint }) {
  return {
    cells: state.cells.map((c) => ({ ...c })), // 现场拷贝，绝不与引擎内部状态共享引用
    edges: edgesFor(state.pathFrom, state.pathToSet, state.cells),
    pointers: state.pointers.map((p) => ({ ...p })),
    marks: { ...state.marks },
    clickable: [...state.clickable],
    levels: state.levels,
    seq: [...state.seq],
    seqMark: state.seqMark,
    groups: state.groups.map((g) => [...g]),
    queue: [...state.queue],
    outputIds: [...state.outputIds],
    cellsById: state.cellsById, // 只读索引，供 checkPick 查格子；帧间共享无妨
    ask: null, // 纯点击题，全程没有提问控件
    done: state.done,
    caption,
    hint,
  }
}

const queueText = (queue, cellsById) =>
  queue.length ? queue.map((id) => cellsById[id].value).join('、') : '（空）'

/**
 * 重放出完整帧序列。逐帧口径：初始 1 帧；每轮 2 帧，固定「出队高亮（active + 序列追加）」在前、
 * 「孩子进下一行（加 path、下一层首格进 clickable）」在后。
 * @param {{nums?: number[], picks?: string[]}} options picks 是被点中的格子 id 序列
 */
export function buildFrames({ nums = DEFAULT_NUMS, picks = [] } = {}) {
  const { cells, levels } = parse(nums)

  if (levels === 0) {
    return [
      snapshot(
        {
          cells: [],
          cellsById: {},
          levels: 1,
          pointers: [],
          marks: {},
          clickable: [],
          seq: [],
          seqMark: null,
          groups: [],
          queue: [],
          outputIds: [],
          pathFrom: null,
          pathToSet: new Set(),
          done: true,
        },
        {
          caption: '空树：一个节点都没有，层序序列为空。',
          hint: '换一组至少 1 个节点的数据再来练。',
        },
      ),
    ]
  }

  if (levels > MAX_LEVELS) {
    return [
      snapshot(
        {
          cells: [],
          cellsById: {},
          levels: 1,
          pointers: [],
          marks: {},
          clickable: [],
          seq: [],
          seqMark: null,
          groups: [],
          queue: [],
          outputIds: [],
          pathFrom: null,
          pathToSet: new Set(),
          done: true,
        },
        {
          caption: `本题只支持 4 层以内（当前 ${levels} 层），换一个数据再练。`,
          hint: `层级一深，画布缩放后点击热区就不够了：${levels} 层的热区只剩约 43px。`,
        },
      ),
    ]
  }

  const cellsById = {}
  for (const c of cells) cellsById[c.id] = c

  const state = {
    cells,
    cellsById,
    levels,
    queue: [cells[0].id], // 队列初始 [根]
    outputIds: [],
    seq: [],
    seqMark: null,
    groups: [], // 分组答案：groups[l-1] = 第 l 层的值
    pointers: [], // ArrayCanvas 层界指针：{ name:'d2', at:下一层第一个下标 }
    marks: {},
    clickable: [],
    pathFrom: null,
    pathToSet: new Set(),
    done: false,
  }
  state.clickable = clickableOf(state.queue, cellsById)

  const root = cellsById[state.queue[0]]
  const frames = [
    snapshot(state, {
      caption: `层序 = 一层一层、每层从左到右。这棵树共 ${levels} 层、${cells.filter((c) => !c.empty).length} 个真实节点。队列初始只有根 ${descOf(root)} —— 点它 = 出队。`,
      hint: '出队一个节点，它的两个孩子才进队；队首永远是你下一个该点的。',
    }),
  ]

  for (const pick of picks) {
    if (state.done) break // 已完成：多余的 pick 忽略
    if (pick !== state.queue[0]) continue // 答错静默跳过：不产帧不报错，判错归 checkPick

    const front = cellsById[state.queue[0]]
    const isLayerFirst = state.groups.length === front.d - 1 // 第 front.d 层的第一个
    const layerRemainedBefore = state.queue.filter((id) => cellsById[id].d === front.d).length

    // —— ① 出队高亮：active + 序列追加 ——
    state.queue.shift()
    state.outputIds = [...state.outputIds, front.id]
    state.seq = [...state.seq, front.value]
    state.seqMark = state.seq.length - 1
    if (isLayerFirst) state.groups.push([front.value])
    else state.groups[state.groups.length - 1].push(front.value)
    // 层界指针：新层第一个被出队的这一刻才落下（提前一格就把还没出队的层标出来了个寂寞）
    if (isLayerFirst && front.d > 1) state.pointers = [...state.pointers, { name: `d${front.d}`, at: state.seqMark }]
    const marks = {}
    for (const id of state.outputIds.slice(0, -1)) marks[id] = 'ok'
    marks[front.id] = 'active'
    state.marks = marks
    state.pathFrom = null
    state.pathToSet = new Set()
    state.clickable = []
    frames.push(
      snapshot(state, {
        caption: isLayerFirst
          ? `第 ${front.d} 层开始：出队 ${descOf(front)}，扁平序列追加为 [${state.seq.join('、')}]。`
          : `出队 ${descOf(front)}：本层从左到右轮到它（前面还有 ${state.groups[front.d - 1].length - 1} 个同层的），序列追加为 [${state.seq.join('、')}]。`,
        hint: '队列是先进先出的：谁最先进队，谁先出。',
      }),
    )

    // —— ② 孩子进下一行：加 path、下一层首格进 clickable ——
    const children = childrenOf(front, cellsById)
    state.queue = [...state.queue, ...children.map((c) => c.id)]
    state.pathFrom = front.id
    state.pathToSet = new Set(children.map((c) => c.id))
    state.marks = { ...state.marks, [front.id]: 'ok' }
    state.clickable = clickableOf(state.queue, cellsById)
    const isLayerEnd = state.queue.length === 0 || cellsById[state.queue[0]].d > front.d
    if (state.queue.length === 0) state.done = true // 先置位再快照：最后一帧必须自带 done

    let caption
    if (children.length === 2) {
      caption = `${descOf(front)} 的两个孩子 ${descOf(children[0])}、${descOf(children[1])} 进队（蓝线）—— 队列变成 [${queueText(state.queue, cellsById)}]。`
    } else if (children.length === 1) {
      caption = `${descOf(front)} 只有一个孩子 ${descOf(children[0])} 进队（蓝线）—— 队列变成 [${queueText(state.queue, cellsById)}]。`
    } else if (front.d === levels) {
      caption = `${descOf(front)} 在第 ${levels} 层（最深层），不会再有孩子进队 —— 队列不变：[${queueText(state.queue, cellsById)}]。`
    } else if (front.d + 1 === levels) {
      caption = `${descOf(front)} 没有孩子：缺失的孩子槽落在第 ${levels} 层（最深层），按契约不画 —— 队列不变：[${queueText(state.queue, cellsById)}]。`
    } else {
      caption = `${descOf(front)} 没有孩子，队列不变：[${queueText(state.queue, cellsById)}]。`
    }
    if (isLayerEnd && !state.done) {
      caption += `本层（第 ${front.d} 层）出完了 —— 接下来整层都是第 ${front.d + 1} 层。`
    }
    if (state.done) {
      caption = `队列空了 —— 层序完成。分组结果：${state.groups.map((g) => `[${g.join('、')}]`).join(' ')}。`
    }
    frames.push(
      snapshot(state, {
        caption,
        hint: state.done
          ? '点「重来」再走一遍：这次每层开始前，先自己报出这一层有哪些节点。'
          : `蓝线 = 刚进队的孩子。${isLayerEnd ? '层与层的交界就在这一轮。' : '队首（下一个该点的）在琥珀色之外的绿色队伍最前面。'}`,
      }),
    )
  }
  return frames
}

/**
 * 校验一次点击。判错文案必须来自当前帧的真实数值：
 * 越层（致命）：本层没出完就点下一层 —— 点名「本层还剩 N 个」；
 * 顺序错：点本层非队首 —— 「队列先进先出」；
 * 越界重复：已出队 / 已走完；另有「还不在队列里」（父节点没出队，孩子没被发现）。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (typeof pick !== 'string' || !/^s\d+$/.test(pick)) return { ok: false, message: '这不是画布上的格子。' }

  const cell = frame.cellsById[pick]
  if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
  if (frame.clickable.length > 0 && pick === frame.clickable[0]) return { ok: true, message: '' }

  if (frame.outputIds.includes(pick)) return { ok: false, message: '它已经在答案里了。' }

  const frontId = frame.queue[0]
  if (frontId !== undefined && frame.queue.includes(pick)) {
    const front = frame.cellsById[frontId]
    if (cell.d > front.d) {
      const remained = frame.queue.filter((id) => frame.cellsById[id].d === front.d)
      const list = remained.map((id) => descOf(frame.cellsById[id])).join('、')
      return {
        ok: false,
        message: `越层了：本层（第 ${front.d} 层）还剩 ${remained.length} 个没出队 —— ${list} 都得先出；${descOf(cell)} 是第 ${cell.d} 层的，要等本层出完才轮得到。`,
      }
    }
    return {
      ok: false,
      message: `队列先进先出：${descOf(front)} 比 ${descOf(cell)} 先进队，得先出 ${descOf(front)}。`,
    }
  }

  if (cell.empty) return { ok: false, message: `${pick} 是空槽，永远进不了队列。` }

  const parent = frame.cellsById[slotId(cell.d - 1, Math.floor(cell.k / 2))]
  if (parent && !frame.outputIds.includes(parent.id)) {
    return {
      ok: false,
      message: `${descOf(cell)} 还不在队列里：它的父节点 ${descOf(parent)} 还没出队 —— 出队一个，才放它的两个孩子进队。`,
    }
  }
  if (frontId !== undefined) {
    return {
      ok: false,
      message: `现在该出队的是 ${descOf(frame.cellsById[frontId])}，${descOf(cell)} 得再等等。`,
    }
  }
  return { ok: false, message: '队列已经空了。' }
}
