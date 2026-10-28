/**
 * 94 二叉树的中序遍历 —— TreeCanvas 的第一个使用者。
 *
 * 纯点击题（定案 4）：没有 ask 控件，picks 词汇只有格子 id（s0…s14）。
 * 题眼：槽位 x 从左到右扫一遍就是中序 —— 这是布局层锁死完全二叉树槽位 x
 * 白拿的几何事实（左子树全部格子的 x < 根的 x < 右子树全部格子的 x），
 * 引擎直接把「期望点击序列」定为「全部格子按 x 升序」，含空格：
 * 空格轮 = 「确认这一侧没有节点」，同样按 x 排进扫描顺序。
 *
 * 范式同 reverse-list：纯函数、无 Vue 依赖，全部状态由「初始数据 + picks」重放；
 * 答错的 pick 在 buildFrames 里静默跳过、不产帧、不报错（深链安全复放的前提），
 * 判错与反馈归 checkPick；空数据必须出 1 帧且 done:true。
 */
import { slotId, slotIdx, slotX } from '../../../core/tree-geom.js'

export const FIXTURE_A = [1, null, 2, 3]
export const FIXTURE_B = [10, 5, 15, 3, null, 13, 18, 1]
export const DEFAULT_NUMS = FIXTURE_A

const MAX_LEVELS = 4 // 深度硬锁：真实深度 ≤ 4，5 层热区只剩 ≈43px

/**
 * LeetCode 层序解析（3.1 口径，本轮最大歧义源）：
 * 层数组是 BFS 队列分配、不是堆下标填充 —— 按队列顺序给每个真实节点分配左右孩子；
 * 读到 null 输出空格、不入队、不为它分配孩子；数组提前结束则剩余孩子为 null（不画）。
 * 所以 [1,null,2,3] 里 2 的左孩子 3 落在 s5（d3k2），不是堆下标直觉的 s3。
 *
 * 空格规则：只画「真实父节点的缺失孩子」、且不在第 L 层（深度 = L 的节点的孩子不进画面）；
 * 空格自己不生孩子（不入队，天然成立）。
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
  // 第 L 层不产空格：显式 null 落在第 L 层时（如 [1,null,2,3,null] 的 s6）不进画面
  const kept = cells.filter((c) => !c.empty || c.d < levels)
  return { cells: kept, levels }
}

const xOf = (c, levels) => slotX(c.d, c.k, levels)

/** 全部格子按 x 升序 = 中序扫描顺序（题眼），空格一并排入 */
function walkOrder(cells, levels) {
  return [...cells].sort((a, b) => xOf(a, levels) - xOf(b, levels))
}

/** 从根到 (d,k) 的真实祖先链（不含空格）：栈画它、路径线沿它走 */
function pathTo(d, k) {
  const chain = []
  while (d >= 1) {
    chain.unshift({ d, k })
    d -= 1
    k = Math.floor(k / 2)
  }
  return chain
}

function descOf(cell, cellsById) {
  if (!cell.empty) return `${cell.value}（${cell.id}）`
  const parent = cellsById[slotId(cell.d - 1, Math.floor(cell.k / 2))]
  const side = cell.k % 2 === 0 ? '左' : '右'
  return `空槽 ${cell.id}（${parent ? parent.value : '?'} 的${side}孩子位）`
}

/**
 * 结构边表：每个非根格子（含空格）都有一条指向它的边。
 * kind 按帧算：'path' = 两端都在当前栈路径上；'null' = 指向空格；其余 'normal'。
 */
function edgesFor(pathSet, cells) {
  const edges = []
  for (const c of cells) {
    if (c.d === 1) continue
    const parentId = slotId(c.d - 1, Math.floor(c.k / 2))
    let kind = c.empty ? 'null' : 'normal'
    if (!c.empty && pathSet.has(c.id) && pathSet.has(parentId)) kind = 'path'
    edges.push({ from: parentId, to: c.id, kind })
  }
  return edges
}

function snapshot(state, { caption, hint }) {
  const pathSet = new Set(state.stackCells.map((c) => c.id))
  return {
    // cells / edges 现场拷贝：帧会被视图直接当 props 用，绝不和引擎内部状态共享引用
    cells: state.cells.map((c) => ({ ...c })),
    edges: edgesFor(pathSet, state.cells),
    pointers: [],
    marks: { ...state.marks },
    clickable: [...state.clickable],
    levels: state.levels,
    seq: [...state.seq],
    seqMark: state.seqMark,
    stack: state.stackCells.map((c) => ({ id: c.id, value: c.value, sub: `#${slotIdx(c.d, c.k)}` })),
    outputIds: [...state.outputIds],
    confirmedIds: [...state.confirmedIds],
    cellsById: state.cellsById, // 只读索引，供 checkPick 查格子；帧间共享无妨
    ask: null, // 定案 4：94 是纯点击题，全程没有提问控件
    done: state.done,
    caption,
    hint,
  }
}

function nextDesc(state) {
  const order = state.order
  if (state.progress >= order.length) return ''
  return descOf(order[state.progress], state.cellsById)
}

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], picks?: string[]}} options picks 是被点中的格子 id 序列
 * @returns {Frame[]}
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
          marks: {},
          clickable: [],
          seq: [],
          seqMark: null,
          stackCells: [],
          outputIds: [],
          confirmedIds: [],
          order: [],
          progress: 0,
          done: true,
        },
        {
          caption: '空树：一个节点都没有，中序序列为空。',
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
          marks: {},
          clickable: [],
          seq: [],
          seqMark: null,
          stackCells: [],
          outputIds: [],
          confirmedIds: [],
          order: [],
          progress: 0,
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
    marks: {},
    clickable: [],
    seq: [],
    seqMark: null,
    stackCells: [],
    outputIds: [], // 已输出的真实格 id
    confirmedIds: [], // 已确认的空格 id
    order: walkOrder(cells, levels),
    progress: 0,
    done: false,
  }

  const first = state.order[0]
  state.clickable = [first.id]
  const frames = [
    snapshot(state, {
      caption: `中序 = 左子树 → 根 → 右子树。这棵树共 ${cells.filter((c) => !c.empty).length} 个真实节点、${cells.length - cells.filter((c) => !c.empty).length} 个空槽。题眼：按 x 从左到右扫，就是中序。第一个要处理的是 ${nextDesc(state)}。`,
      hint: '虚线格是空槽：它不进序列，但「确认这里没有节点」这一步不能跳。',
    }),
  ]

  for (const pick of picks) {
    if (state.done) break // 多余的 pick：已经完成，直接忽略
    if (pick !== state.order[state.progress].id) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    if (state.order[state.progress].empty) pushEmptyRound(frames, state)
    else pushVisitRound(frames, state)
  }
  return frames
}

/** 空格轮：1 帧 —— 点它 = 确认这一侧没有节点，退回去 */
function pushEmptyRound(frames, state) {
  const cell = state.order[state.progress]
  const parentId = slotId(cell.d - 1, Math.floor(cell.k / 2))
  const parent = state.cellsById[parentId]
  const side = cell.k % 2 === 0 ? '左' : '右'

  state.stackCells = pathTo(cell.d - 1, Math.floor(cell.k / 2))
    .map(({ d, k }) => state.cellsById[slotId(d, k)])
    .filter(Boolean)
  const marks = {}
  for (const id of state.outputIds) marks[id] = 'ok'
  marks[cell.id] = 'active'
  state.marks = marks
  state.confirmedIds = [...state.confirmedIds, cell.id]
  state.progress += 1

  const isLast = state.progress >= state.order.length
  state.clickable = isLast ? [] : [state.order[state.progress].id]
  if (isLast) state.done = true // 先置位再快照：最后一帧必须自带 done
  frames.push(
    snapshot(state, {
      caption: `${cell.id} 是空的：${parent.value} 没有${side}孩子，这一侧到此为止，退回去处理 ${parent.value}。`,
      hint: '∅ 不进序列 —— 它只代表「这里没有节点」，但这一步不能省，否则你不知道该不该回访父节点。',
    }),
  )
}

/** 真实节点轮：2 帧 —— ① 高亮 + 路径线 ② 序列追加 */
function pushVisitRound(frames, state) {
  const cell = state.order[state.progress]

  // ① 高亮：该格转琥珀色，已输出的转绿；路径线 = 栈内格之间的既有斜线改色加粗
  state.stackCells = pathTo(cell.d, cell.k).map(({ d, k }) => state.cellsById[slotId(d, k)]).filter(Boolean)
  const marks = {}
  for (const id of state.outputIds) marks[id] = 'ok'
  marks[cell.id] = 'active'
  state.marks = marks
  frames.push(
    snapshot(state, {
      caption: `走到 ${cell.value}（${cell.id}）：按 x 扫到这里，它左边的格子都处理完了，蓝色的线就是从根下来的路径。`,
      hint: '中序的「根」在这两帧之间：先确认左边走完，才轮到它自己。',
    }),
  )

  // ② 序列追加：该格转绿，新值进序列
  state.outputIds = [...state.outputIds, cell.id]
  state.seq = [...state.seq, cell.value]
  state.seqMark = state.seq.length - 1
  state.marks = { ...state.marks, [cell.id]: 'ok' }
  state.progress += 1

  const isLast = state.progress >= state.order.length
  state.clickable = isLast ? [] : [state.order[state.progress].id]
  if (isLast) state.done = true // 先置位再快照：最后一帧必须自带 done
  const seqText = `[${state.seq.join(', ')}]`
  frames.push(
    snapshot(state, {
      caption: isLast
        ? `${cell.value} 进序列：${seqText}。中序完成 —— 和按 x 从左到右读完全一致。`
        : `${cell.value} 进序列：当前输出 ${seqText}。下一个按 x 排是 ${nextDesc(state)}。`,
      hint: isLast
        ? '点「重来」再走一遍：这次先自己说出完整顺序，再动手点。'
        : '绿格子 = 已进序列的节点；琥珀色 = 正在处理的那一格。',
    }),
  )
}

/**
 * 校验一次点击。三类反馈性质完全不同（文案里的数必须来自当前帧）：
 * 概念错（致命）：跳过没走完的左子树 —— 点名格子与值、说清违反哪条不变式；
 * 顺序错（不致命）：空格确认早了 —— 「不坏，但必须排在…之后」；
 * 越界重复：已走完 / 已点过。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (typeof pick !== 'string' || !/^s\d+$/.test(pick)) return { ok: false, message: '这不是画布上的格子。' }

  const cell = frame.cellsById[pick]
  if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
  if (frame.clickable.includes(pick)) return { ok: true, message: '' }

  if (frame.outputIds.includes(pick) || frame.confirmedIds.includes(pick)) {
    return { ok: false, message: '它已经在答案里了。' }
  }

  const x = xOf(cell, frame.levels)
  const leftPending = frame.cells
    .filter(
      (c) =>
        xOf(c, frame.levels) < x && !frame.outputIds.includes(c.id) && !frame.confirmedIds.includes(c.id),
    )
    .sort((a, b) => xOf(a, frame.levels) - xOf(b, frame.levels))
  const pendingText = leftPending.map((c) => descOf(c, frame.cellsById)).join('、')

  // 顺序错（不致命）：空格确认早了
  if (cell.empty) {
    return {
      ok: false,
      message: pendingText
        ? `不坏，但必须排在它们之后：${cell.id} 左边还有没处理的 ${pendingText}。`
        : `不坏，但这一步还轮不到 ${cell.id} —— 现在该处理的是 ${descOf(frame.cellsById[frame.clickable[0]], frame.cellsById)}。`,
    }
  }

  // 概念错（致命）：跳过了左边没走的格子（含「点祖先」）
  if (pendingText) {
    return {
      ok: false,
      message: `中序必须先走左子树：点 ${cell.value}（${cell.id}）之前，它左边还没走的 ${pendingText} 都得先处理。`,
    }
  }

  return {
    ok: false,
    message: `现在该处理的是 ${descOf(frame.cellsById[frame.clickable[0]], frame.cellsById)}，${cell.value}（${cell.id}）得再等等。`,
  }
}
