/**
 * 104 二叉树的最大深度 —— TreeCanvas 的第三种交互：回溯值预测。
 *
 * 纯点击 + 预测混合题：picks 词汇 = 格子 id（s0…s14，含空格）+ guess-<整数>（0–4）。
 * 题眼：每个节点回溯时带回 max(左, 右) + 1；空槽带回 0；第 L 层的孩子槽不进画面、按 ∅ 算。
 *
 * 事件模型：先把整棵树的后序 DFS 展开成事件序列
 *   enter C → [孩子的 enter/empty 事件…] → ask C → merge C
 * 每个「实格」贡献 3 帧（进入 / ask 预测 / 合并），「空格」贡献 1 帧（点中即返回 0）。
 * pick 消费规则：enter/empty 由格子 id 触发；merge 由答对的 guess 触发；
 * 事件序列里紧跟的 ask 永远自动跟车（和触发它的 pick 同批产帧、落在提问上）——
 * 出帧顺序固定「进入 → ask → 合并」，反了会让 answer 提前填上。
 *
 * 范式同 94/102：纯函数、无 Vue；答错的 pick 静默跳过（深链安全复放），判错归 checkPick。
 * 坐标零字面量：只 import slotId。
 */
import { slotId } from '../../../core/tree-geom.js'

export const FIXTURE_A = [3, 9, 20, null, null, 15, 7]
export const FIXTURE_B = [1, 2, null, 3, null, 4]
export const DEFAULT_NUMS = FIXTURE_A

const MAX_LEVELS = 4 // 深度硬锁：真实深度 ≤ 4，5 层热区只剩 ≈43px
const GUESS_MAX = 4

/** LeetCode 层序解析（与 94/102 同一口径）：BFS 队列分配；null 只占位不入队；空格只画 d < L 的缺失孩子 */
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

const descOf = (c, cellsById) => {
  if (!c.empty) return `${c.value}（${c.id}）`
  const parent = cellsById[slotId(c.d - 1, Math.floor(c.k / 2))]
  const side = c.k % 2 === 0 ? '左' : '右'
  return `空槽 ${c.id}（${parent ? parent.value : '?'} 的${side}孩子位）`
}

/**
 * 事件序列 + 各节点回溯值。
 * ret(C) = 1 + max(左来源, 右来源)；来源：真实孩子 = 其 ret；画出来的空槽 = 0；不进画面的槽 = 0。
 */
function planWalk(cellsById, levels) {
  const events = []
  const returns = new Map()

  const childAt = (node, side) => cellsById[slotId(node.d + 1, node.k * 2 + side)]
  const sideValue = (node, side) => {
    const child = childAt(node, side)
    if (child && !child.empty) return { value: returns.get(child.id), desc: `子树 ${child.value}（${child.id}）带回` }
    if (child && child.empty) return { value: 0, desc: `空槽 ${child.id} 返回 0` }
    return { value: 0, desc: `第 ${levels} 层的空格不进画面、按 0 算` }
  }

  function walk(node) {
    events.push({ type: 'enter', cell: node })
    for (const side of [0, 1]) {
      const child = childAt(node, side)
      if (child && !child.empty) walk(child)
      else if (child && child.empty) events.push({ type: 'empty', cell: child })
      // 不进画面的槽（d = L 或数组提前结束）：没有事件，按 ∅ 算
    }
    events.push({ type: 'ask', cell: node })
    events.push({ type: 'merge', cell: node })
    const lv = sideValue(node, 0)
    const rv = sideValue(node, 1)
    returns.set(node.id, 1 + Math.max(lv.value, rv.value))
  }

  walk(cellsById[slotId(1, 0)])
  return { events, returns, sideValue }
}

/** 结构边表：每个非根格子一条边；'path' = 递归栈内相邻格之间；'null' = 指向空格 */
function edgesFor(stack, cells) {
  const stackSet = new Set(stack)
  const edges = []
  for (const c of cells) {
    if (c.d === 1) continue
    const parentId = slotId(c.d - 1, Math.floor(c.k / 2))
    let kind = c.empty ? 'null' : 'normal'
    if (!c.empty && stackSet.has(c.id) && stackSet.has(parentId)) kind = 'path'
    edges.push({ from: parentId, to: c.id, kind })
  }
  return edges
}

/**
 * 出一道预测题。选项按出题序号轮转（照 reverse-list/engine.js 的轮转写法）：
 * 正确答案不能永远停在同一个位置；用轮转而不是随机，同一份 picks 永远复现同一组顺序。
 * 候选 = 正确值 + 少 1 的（忘加一的错）+ 一个明显偏大的（0–4 内取）。
 */
function makeAsk(cell, askIndex, answer, sideValue) {
  const big = Math.min(answer + 2, GUESS_MAX)
  const base = [...new Set([answer - 1, answer, big])].filter((v) => v >= 0)
  const rotated = base.map((_, k) => base[(k + askIndex) % base.length])
  const lv = sideValue(cell, 0)
  const rv = sideValue(cell, 1)
  return {
    cellId: cell.id,
    prompt: `${cell.value}（${cell.id}）回溯时该带回几？`,
    options: rotated.map((v) => ({ pick: `guess-${v}`, label: `带回 ${v}` })),
    answer,
    explain: `左边：${lv.desc} ${lv.value}；右边：${rv.desc} ${rv.value} —— max(${lv.value}, ${rv.value}) + 1 = ${answer}。`,
  }
}

function snapshot(state, { ask = null, caption, hint }) {
  return {
    cells: state.cells.map((c) => ({ ...c })), // 现场拷贝，绝不与引擎内部状态共享引用
    edges: edgesFor(state.stack, state.cells),
    pointers: state.pointers.map((p) => ({ ...p })),
    marks: { ...state.marks },
    clickable: [...state.clickable],
    levels: state.levels,
    answer: [...state.answer],
    answerMark: state.answerMark,
    depth: state.depth,
    mergedIds: [...state.mergedIds],
    cellsById: state.cellsById, // 只读索引，供 checkPick 查格子；帧间共享无妨
    ask, // 预测帧带 ask；其余帧恒为 null
    done: state.done,
    caption,
    hint,
  }
}

const emptyState = () => ({
  cells: [],
  cellsById: {},
  levels: 1,
  stack: [],
  pointers: [],
  marks: {},
  clickable: [],
  answer: [],
  answerMark: null,
  depth: null,
  mergedIds: [],
  done: true,
})

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], picks?: string[]}} options picks = [格子 id | guess-N] 序列
 */
export function buildFrames({ nums = DEFAULT_NUMS, picks = [] } = {}) {
  const { cells, levels } = parse(nums)

  if (levels === 0) {
    return [
      snapshot({ ...emptyState(), depth: 0 }, {
        caption: '空树：一个节点都没有，最大深度为 0。',
        hint: '换一组至少 1 个节点的数据再来练。',
      }),
    ]
  }

  if (levels > MAX_LEVELS) {
    return [
      snapshot(emptyState(), {
        caption: `本题只支持 4 层以内（当前 ${levels} 层），换一个数据再练。`,
        hint: `层级一深，画布缩放后点击热区就不够了：${levels} 层的热区只剩约 43px。`,
      }),
    ]
  }

  const cellsById = {}
  for (const c of cells) cellsById[c.id] = c
  const { events, returns, sideValue } = planWalk(cellsById, levels)
  const realCount = cells.filter((c) => !c.empty).length

  const state = {
    cells,
    cellsById,
    levels,
    stack: [], // 递归栈（真实格 id，根→当前）
    pointers: [{ name: 'cur', at: null }], // 开局 cur 悬空：还没进任何格子
    marks: {},
    clickable: [],
    answer: [],
    answerMark: null,
    depth: null,
    mergedIds: [],
    pendingAsk: null, // 正在等预测的格子 id（ask 帧已产、guess 未答）
    done: false,
  }

  /** 帧内着色：已合并 = ok；当前主角（进入/提问/空格轮）= active */
  const marksFor = (activeId) => {
    const marks = {}
    for (const id of state.mergedIds) marks[id] = 'ok'
    if (activeId) marks[activeId] = 'active'
    return marks
  }

  const root = cellsById[slotId(1, 0)]
  state.clickable = [root.id]
  const frames = [
    snapshot(state, {
      caption: `最大深度 = 根节点回溯时带回来的值。这棵树共 ${levels} 层、${realCount} 个真实节点${cells.length - realCount ? `、${cells.length - realCount} 个空槽` : ''}。从根 ${root.value}（${root.id}）开始：点一个格子 = 进入它。`,
      hint: '每个节点回溯时带回 max(左, 右) + 1；空槽带回 0；第 L 层的孩子槽不进画面、按 ∅ 算。',
    }),
  ]

  let ei = 0 // 事件游标
  let askCount = 0 // 出题序号：选项轮转用

  /**
   * 消费一个事件并出帧。紧跟的 ask 永远自动跟车（同批产帧）；
   * clickable 先行更新再快照 —— 帧上带的是「这一帧之后该干什么」。
   */
  function consume(event) {
    const cell = event.cell
    const parent = cell.d === 1 ? null : cellsById[slotId(cell.d - 1, Math.floor(cell.k / 2))]
    let frameState

    if (event.type === 'enter') {
      state.stack.push(cell.id)
      state.pointers = [{ name: 'cur', at: cell.id }]
      state.marks = marksFor(cell.id)
      frameState = {
        caption: `进入 ${cell.value}（${cell.id}）：从根下来的蓝线就是递归栈，现在有 ${state.stack.length} 格。`,
        hint: '左右子树都要走完，才轮到它自己的回溯值。',
      }
    } else if (event.type === 'empty') {
      state.pointers = [
        { name: 'cur', at: cell.id },
        { name: 'back', at: parent ? parent.id : null },
      ]
      state.marks = marksFor(cell.id)
      frameState = {
        caption: `${cell.id} 这里没有节点，返回 0 —— 回到 ${parent ? `${parent.value}（${parent.id}）` : '根'}。`,
        hint: '空格 ∅ 不是节点：它不进答案行，只是把「这一侧没有子树」告诉父节点。',
      }
    } else {
      // merge：回溯值进答案行，节点转绿，出栈
      const ret = returns.get(cell.id)
      state.stack.pop()
      state.answer = [...state.answer, ret]
      state.answerMark = state.answer.length - 1
      state.mergedIds = [...state.mergedIds, cell.id]
      state.marks = marksFor(null)
      state.pointers = [{ name: 'back', at: parent ? parent.id : null }] // 根的 back 悬空
      const lv = sideValue(cell, 0)
      const rv = sideValue(cell, 1)
      if (ei === events.length - 1) {
        state.done = true // 先置位再快照：最后一帧必须自带 done
        state.depth = ret
      }
      frameState = {
        caption:
          ei === events.length - 1
            ? `根 ${cell.value}（${cell.id}）带回 ${ret} —— 最大深度就是 ${ret}。`
            : `${cell.value}（${cell.id}）带回 ${ret}（max(${lv.value}, ${rv.value}) + 1），回到 ${parent ? `${parent.value}（${parent.id}）` : '根'}。`,
        hint:
          ei === events.length - 1
            ? '答案行的最后一个值 = 根的返回值 = 最大深度。点「重来」再走一遍，这轮先自己报数。'
            : '答案行每追加一格都是一次回溯：它单调不减 —— 父节点带回来的永远不小于孩子。',
      }
    }

    ei += 1

    // 先定「这一帧之后该干什么」，再快照
    let trailingAsk = null
    if (ei < events.length && events[ei].type === 'ask') {
      const askCell = events[ei].cell
      trailingAsk = makeAsk(askCell, askCount, returns.get(askCell.id), sideValue)
      askCount += 1
      state.clickable = []
      state.pendingAsk = askCell.id
      ei += 1 // ask 事件一并消费（它的帧在下面跟车出）
    } else if (ei < events.length) {
      state.clickable = [events[ei].cell.id]
      state.pendingAsk = null
    } else {
      state.clickable = []
      state.pendingAsk = null
    }

    frames.push(snapshot(state, frameState))

    if (trailingAsk) {
      const askCell = cellsById[trailingAsk.cellId]
      state.marks = marksFor(askCell.id)
      frames.push(
        snapshot(state, {
          ask: trailingAsk,
          caption: `${askCell.value}（${askCell.id}）的子树走完了：预测它回溯时该带回几。${trailingAsk.explain}`,
          hint: '想清楚左右两边各带回了什么再选 —— 猜错不惩罚路径，只会让你重选。',
        }),
      )
    }
  }

  for (const pick of picks) {
    if (state.done || ei >= events.length) break
    if (state.pendingAsk !== null) {
      // 等预测：只认答对的 guess（ask 帧已随上一个 pick 产好）
      if (pick === `guess-${returns.get(state.pendingAsk)}`) consume(events[ei]) // 'merge'
      // 答错静默跳过：不产帧，判错归 checkPick
      continue
    }
    if (pick === events[ei].cell.id) consume(events[ei]) // 'enter' 或 'empty'
    // 不匹配的 pick 静默跳过
  }
  return frames
}

/**
 * 校验一次选择（混合词汇）。判错文案必须来自当前帧的真实数值：
 * 预测错：「路径没错，是这个节点回来的值不对」—— 不惩罚路径；
 * 空格轮点实格 / 已合并 / 越序进入：各自点名。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }

  const isCell = typeof pick === 'string' && /^s\d+$/.test(pick)
  const isGuess = typeof pick === 'string' && /^guess-(\d+)$/.test(pick)
  if (!isCell && !isGuess) return { ok: false, message: '这不是有效的选择：要么点画布格子，要么选「带回几」。' }

  if (frame.ask) {
    const askCell = frame.cellsById[frame.ask.cellId]
    if (isCell) {
      const cell = frame.cellsById[pick]
      if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
      return {
        ok: false,
        message: `这一步不用点格子：${askCell.value}（${askCell.id}）的左右子树都走完了，先回答它回溯时该带回几。`,
      }
    }
    const n = Number(pick.slice(6))
    if (n < 0 || n > GUESS_MAX) return { ok: false, message: `预测只能是 0–${GUESS_MAX}。` }
    if (n === frame.ask.answer) return { ok: true, message: '' }
    return {
      ok: false,
      message: `路径没错，是 ${askCell.value}（${askCell.id}）该带回的值不对：${frame.ask.explain}`,
    }
  }

  // 格子决策帧
  if (isGuess) {
    const target = frame.clickable[0]
    return {
      ok: false,
      message: `现在不是预测的时候：该点 ${descOf(frame.cellsById[target], frame.cellsById)}（进入它）。`,
    }
  }
  const cell = frame.cellsById[pick]
  if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
  if (frame.clickable[0] === pick) return { ok: true, message: '' }

  if (frame.mergedIds.includes(pick)) {
    return { ok: false, message: '它已经在答案里了（子树走完、值已合并）。' }
  }
  const target = frame.clickable[0]
  const targetCell = frame.cellsById[target]
  // 空格轮点实格：点名空格与被点的实格
  if (targetCell && targetCell.empty && !cell.empty) {
    return {
      ok: false,
      message: `现在是空格轮：先点 ${descOf(targetCell, frame.cellsById)} 确认这里没有节点（返回 0）—— ${descOf(cell, frame.cellsById)} 的子树还没轮到。`,
    }
  }
  return {
    ok: false,
    message: `现在进不去 ${descOf(cell, frame.cellsById)}：递归要先走 ${descOf(targetCell, frame.cellsById)}。`,
  }
}
