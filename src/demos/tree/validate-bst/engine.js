/**
 * 98 验证二叉搜索树 —— TreeCanvas 的第四次使用者，`range` 横条的第一个真正用户。
 *
 * 混合词汇纯函数引擎：picks = [格子 id（含空格，中序访问）| bound-update | bound-inherit]。
 * 题眼：合法 BST ⟺ 中序严格递增 ⟺ 每个节点落在「祖先传下来的开区间」内。
 * 只比父子不够：C 组 [5,4,null,3,7] 父子全过，但 7 在 5 的左子树、继承上界 5，7 > 5 违规 ——
 * 只有带界抓得到。
 *
 * 轮与帧：真实格 3 帧（① 边界 ask「进入前要不要收紧」→ ② 判定/访问 → ③ range 收窄结果）；
 * 空格 1 帧（点它 = 这里没有节点、返回合法）。
 * range 语义：当前节点的合法区间 (lo, hi) 映射成两个格子 id ——
 *   有限界 → 设定该界的祖先格；−∞ → 全树最左格；+∞ → 最右格（「没有约束」= 横条铺满全树宽）。
 * 槽位 x 有个白拿的事实：x(lo) < x(hi) 恒成立（两种祖先位置的Case各证一次），横条不会负宽。
 *
 * bound-inherit 的双重身份：checkPick 判它 ok:false（不收紧界 = 退化成父子比较，C 组就会漏），
 * 但 buildFrames 里它可执行（sticky：一旦选了继承，后续全部按父子比较判）——
 * 引擎层面必须能演出「父子比较的漏网：C 判成 true」。
 *
 * 范式同 94/102/104：答错的 pick 静默跳过；坐标零字面量（只 import slotId/slotX）。
 */
import { slotId, slotX } from '../../../core/tree-geom.js'

export const FIXTURE_A = [2, 1, 3]
export const FIXTURE_B = [5, 1, 4, null, null, 3, 6]
export const FIXTURE_C = [5, 4, null, 3, 7]
export const DEFAULT_NUMS = FIXTURE_A

const MAX_LEVELS = 4 // 深度硬锁：真实深度 ≤ 4，5 层热区只剩 ≈43px

/** LeetCode 层序解析（与前三题同一口径）：BFS 队列分配；null 只占位不入队；空格只画 d < L 的缺失孩子 */
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

/**
 * 每个格子（含空格）的合法区间与父系信息。
 * 左孩子区间 = (父.lo, 父.value)；右孩子 = (父.value, 父.hi)；根 = (−∞, +∞)。
 * lo/hi 各记 { v, id }（设定界的祖先格）；null = 无穷。
 */
function annotate(cells, cellsById) {
  const info = new Map()
  const root = cellsById[slotId(1, 0)]
  info.set(root.id, { lo: null, hi: null, parentId: null, side: 0 })
  const queue = [root]
  while (queue.length > 0) {
    const node = queue.shift()
    const ni = info.get(node.id)
    for (const side of [0, 1]) {
      const child = cellsById[slotId(node.d + 1, node.k * 2 + side)]
      if (!child) continue
      info.set(
        child.id,
        side === 0
          ? { lo: ni.lo, hi: { v: node.value, id: node.id }, parentId: node.id, side: 0 }
          : { lo: { v: node.value, id: node.id }, hi: ni.hi, parentId: node.id, side: 1 },
      )
      if (!child.empty) queue.push(child) // 空格不生孩子，也不进队
    }
  }
  return info
}

const descOf = (c, cellsById) => {
  if (!c.empty) return `${c.value}（${c.id}）`
  const parent = cellsById[slotId(c.d - 1, Math.floor(c.k / 2))]
  const side = c.k % 2 === 0 ? '左' : '右'
  return `空槽 ${c.id}（${parent ? parent.value : '?'} 的${side}孩子位）`
}

const intervalText = (inf) => `(${inf.lo ? inf.lo.v : '−∞'}, ${inf.hi ? inf.hi.v : '+∞'})`

/** 区间映射成 range 横条的两端格子 id（有限界 → 祖先格；无穷 → 全树最左/最右格） */
function rangeOf(inf, leftmostId, rightmostId) {
  return { lo: inf.lo ? inf.lo.id : leftmostId, hi: inf.hi ? inf.hi.id : rightmostId }
}

/** 更新模式判定：严格落在开区间内 */
function judgeWithBounds(cell, inf) {
  const loV = inf.lo ? inf.lo.v : -Infinity
  const hiV = inf.hi ? inf.hi.v : Infinity
  if (cell.value <= loV) return { valid: false, dir: '下', bound: inf.lo }
  if (cell.value >= hiV) return { valid: false, dir: '上', bound: inf.hi }
  return { valid: true, dir: null, bound: null }
}

/** 继承模式判定（退化的父子比较）：根不查；左孩子 < 父；右孩子 > 父 */
function judgeByParent(cell, inf, cellsById) {
  if (!inf.parentId) return { valid: true, dir: null, bound: null }
  const parent = cellsById[inf.parentId]
  if (inf.side === 0 && cell.value >= parent.value) return { valid: false, dir: '上', bound: { v: parent.value, id: parent.id } }
  if (inf.side === 1 && cell.value <= parent.value) return { valid: false, dir: '下', bound: { v: parent.value, id: parent.id } }
  return { valid: true, dir: null, bound: null }
}

/**
 * 边界选择题。选项固定两项、按出题序号轮转（照 reverse-list/engine.js 的 makeAsk(round)）：
 * 不轮转 = 正确答案（bound-update）永远停在第一个位置。
 */
function makeAsk(cell, inf, round, cellsById) {
  const base = ['bound-update', 'bound-inherit']
  const rotated = base.map((_, k) => base[(k + round) % base.length])
  const parent = inf.parentId ? cellsById[inf.parentId] : null
  const labels = {
    'bound-update': `收紧：${cell.value}（${cell.id}）必须落在 ${intervalText(inf)} 内`,
    'bound-inherit': parent
      ? `不收紧：只和父节点 ${parent.value}（${parent.id}）比`
      : '不收紧：根节点没有父节点，怎么判都一样',
  }
  return {
    cellId: cell.id,
    prompt: `进入 ${cell.value}（${cell.id}）前，它的合法区间要不要收紧到 ${intervalText(inf)}？`,
    options: rotated.map((pick) => ({ pick, label: labels[pick] })),
    answer: 'bound-update',
  }
}

/** 结构边表：只含真实非根格（本题不给空格画边——⑫ 的口径：C 恰 3 条）；'path' = 根到当前格的链 */
function edgesFor(chain, cells) {
  const chainSet = new Set(chain)
  const edges = []
  for (const c of cells) {
    if (c.d === 1 || c.empty) continue
    const parentId = slotId(c.d - 1, Math.floor(c.k / 2))
    const kind = chainSet.has(c.id) && chainSet.has(parentId) ? 'path' : 'normal'
    edges.push({ from: parentId, to: c.id, kind })
  }
  return edges
}

function snapshot(state, { ask = null, caption, hint }) {
  return {
    cells: state.cells.map((c) => ({ ...c })), // 现场拷贝，绝不与引擎内部状态共享引用
    edges: edgesFor(state.chain, state.cells),
    pointers: [],
    marks: { ...state.marks },
    clickable: [...state.clickable],
    levels: state.levels,
    range: state.range ? { ...state.range } : null, // {lo, hi} 两个格子 id；null = 不画
    seq: [...state.seq],
    seqMark: state.seqMark,
    answer: state.answer,
    judgedIds: [...state.judgedIds],
    cellsById: state.cellsById, // 只读索引，供 checkPick 查格子；帧间共享无妨
    ask,
    done: state.done,
    caption,
    hint,
  }
}

const emptyState = () => ({
  cells: [],
  cellsById: {},
  levels: 1,
  chain: [],
  marks: {},
  clickable: [],
  range: null,
  seq: [],
  seqMark: null,
  answer: null,
  judgedIds: [],
  done: true,
})

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], picks?: string[]}} options picks = [格子 id | bound-*] 序列
 */
export function buildFrames({ nums = DEFAULT_NUMS, picks = [] } = {}) {
  const { cells, levels } = parse(nums)

  if (levels === 0) {
    return [
      snapshot({ ...emptyState(), answer: true }, {
        caption: '空树也是合法的 BST：中序序列为空，严格递增平凡成立（answer = true）。',
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
  const info = annotate(cells, cellsById)

  // 中序 = 槽位 x 升序（94 已证的几何事实），空格一并排进扫描序
  const xOf = (c) => slotX(c.d, c.k, levels)
  const order = [...cells].sort((a, b) => xOf(a) - xOf(b))
  const leftmost = order[0]
  const rightmost = order[order.length - 1]
  const realCount = cells.filter((c) => !c.empty).length

  const state = {
    cells,
    cellsById,
    levels,
    chain: [], // 根 → 当前格（含当前）的链，path 边用
    marks: {},
    clickable: [order[0].id],
    range: null,
    seq: [],
    seqMark: null,
    answer: null,
    judgedIds: [],
    violations: 0,
    mode: 'update', // sticky：一旦 bound-inherit，后续全部按父子比较
    pendingAsk: null, // 正在等边界决策的格子 id
    done: false,
  }

  const marksFor = (activeId) => {
    const marks = {}
    for (const id of state.judgedIds) marks[id] = state.verdictOf[id]
    if (activeId) marks[activeId] = 'active'
    return marks
  }
  state.verdictOf = {} // 已判格子 → 'ok'（合法）| 'active'（越界，保持琥珀警示）

  const chainTo = (cell) => {
    const chain = []
    let cur = cell
    while (cur) {
      chain.unshift(cur.id)
      const inf = info.get(cur.id)
      cur = inf && inf.parentId ? cellsById[inf.parentId] : null
    }
    return chain
  }

  const first = order[0]
  const frames = [
    snapshot(state, {
      caption: `合法 BST ⟺ 中序严格递增 ⟺ 每个节点落在祖先传下来的开区间内。这棵树 ${levels} 层、${realCount} 个真实节点${cells.length - realCount ? `、${cells.length - realCount} 个空槽` : ''}。从最左格 ${descOf(first, cellsById)} 开始 —— 点它进入。`,
      hint: '进入每个节点前，先决策它的合法区间要不要收紧；只比父子是不够的（C 组专门考这个）。',
    }),
  ]

  let wi = 0 // walk 游标（order 下标）
  let askCount = 0

  const finishIfLast = () => {
    if (wi >= order.length) {
      state.done = true // 先置位再快照：最后一帧必须自带 done
      state.answer = state.violations === 0
    }
  }

  for (const pick of picks) {
    if (state.done) break

    if (state.pendingAsk !== null) {
      // 边界决策帧：update / inherit 都可执行（inherit 由 checkPick 在交互层拦，引擎照演漏网）
      if (pick !== 'bound-update' && pick !== 'bound-inherit') continue
      const cell = cellsById[state.pendingAsk]
      const inf = info.get(cell.id)
      if (pick === 'bound-inherit') state.mode = 'inherit' // sticky：界从此不再收紧
      const judged = state.mode === 'update' ? judgeWithBounds(cell, inf) : judgeByParent(cell, inf, cellsById)

      // —— ② 判定/访问 ——
      state.seq = [...state.seq, cell.value]
      state.seqMark = state.seq.length - 1
      state.judgedIds = [...state.judgedIds, cell.id]
      state.verdictOf[cell.id] = judged.valid ? 'ok' : 'active'
      state.range = rangeOf(inf, leftmost.id, rightmost.id)
      state.chain = chainTo(cell)
      let caption
      if (judged.valid) {
        caption =
          state.mode === 'update'
            ? `${cell.value}（${cell.id}）合法：${intervalText(inf)} 内放得下它。中序序列追加：[${state.seq.join('、')}]。`
            : `${cell.value}（${cell.id}）按父子比较通过 —— 但祖先的界被忽略了，这样做 C 组会漏。中序序列追加：[${state.seq.join('、')}]。`
      } else {
        caption = `${cell.value}（${cell.id}）越界：${cell.value} ${judged.dir === '下' ? '<' : '>'} ${judged.bound.v} —— ${cell.value} 越过祖先 ${judged.bound.v}（${judged.bound.id}）传下来的${judged.dir}界。中序序列追加：[${state.seq.join('、')}]。`
        state.violations += 1
      }
      frames.push(
        snapshot(state, {
          caption,
          hint: judged.valid
            ? '绿格 = 已判定合法；底部的横条就是它被允许的区间。'
            : '越界的格子会保持琥珀色 —— 答案已经定为 false，继续走完看还有哪里越界。',
        }),
      )

      // —— ③ range 收窄后的结果帧 ——
      state.marks = marksFor(null)
      state.pendingAsk = null
      wi += 1
      finishIfLast()
      const next = wi < order.length ? order[wi] : null
      state.clickable = next ? [next.id] : []
      frames.push(
        snapshot(state, {
          caption: state.done
            ? `中序走完：[${state.seq.join('、')}]${state.answer ? ' 严格递增 —— 是合法 BST（answer = true）' : ` 不递增 —— 不是 BST（answer = false，共 ${state.violations} 处越界）`}。`
            : `区间收窄完成：${descOf(cell, cellsById)} 的合法区间 ${intervalText(inf)} 已标在底部横条（从 ${state.range.lo} 格到 ${state.range.hi} 格）。下一个：${descOf(next, cellsById)}。`,
          hint: state.done
            ? '点「重来」换一组数据：C 组专考「只比父子够不够」。'
            : '横条的两端 = 设定上下界的祖先格；没有约束的一侧铺到全树边缘。',
        }),
      )
      continue
    }

    // 格子决策帧
    if (wi >= order.length || pick !== order[wi].id) continue
    const cell = order[wi]

    if (cell.empty) {
      // 空格轮：1 帧，点中即返回合法
      const inf = info.get(cell.id)
      state.range = rangeOf(inf, leftmost.id, rightmost.id)
      state.chain = chainTo(cellsById[inf.parentId])
      state.marks = marksFor(cell.id)
      state.marks[cell.id] = 'active'
      wi += 1
      finishIfLast()
      const next = wi < order.length ? order[wi] : null
      state.clickable = next ? [next.id] : []
      frames.push(
        snapshot(state, {
          caption: state.done
            ? `${cell.id} 这里没有节点，返回合法 —— 中序走完：[${state.seq.join('、')}]${state.answer ? ' 严格递增（answer = true）' : ' 不递增（answer = false）'}。`
            : `${cell.id} 这里没有节点，返回合法 —— 若这里有节点，它必须落在 ${intervalText(inf)} 内。下一个：${descOf(next, cellsById)}。`,
          hint: '空格不进中序序列，但它的「合法」也是递归的一环。',
        }),
      )
      continue
    }

    // 真实格：① 边界 ask（进入前）
    const inf = info.get(cell.id)
    state.chain = chainTo(cell)
    state.marks = marksFor(cell.id)
    state.range = rangeOf(inf, leftmost.id, rightmost.id)
    const ask = makeAsk(cell, inf, askCount, cellsById)
    askCount += 1
    state.pendingAsk = cell.id
    state.clickable = []
    frames.push(
      snapshot(state, {
        ask,
        caption: `进入 ${cell.value}（${cell.id}）前：它的合法区间是 ${intervalText(inf)}${inf.lo ? `（下界来自 ${inf.lo.v}（${inf.lo.id}）` : '（下界 −∞'}${inf.hi ? `，上界来自 ${inf.hi.v}（${inf.hi.id}）` : '，上界 +∞'}）—— 要不要按收紧的界判定它？`,
        hint: '收紧 = 按祖先传下来的开区间判；不收紧 = 只和父节点比（C 组会漏）。',
      }),
    )
  }
  return frames
}

/**
 * 校验一次选择（混合词汇）。判错文案必须来自当前帧的真实数值：
 * 边界选错（bound-inherit）：ok:false —— 「不收紧界 = 退化成父子比较，C 组就会漏」，不惩罚路径；
 * 空格轮点实格 / 已判过 / 越序进入：各自点名。
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经走完了，点「重来」再练一次。' }

  const isCell = typeof pick === 'string' && /^s\d+$/.test(pick)
  const isBound = pick === 'bound-update' || pick === 'bound-inherit'
  if (!isCell && !isBound) return { ok: false, message: '这不是有效的选择：要么点画布格子，要么回答边界决策。' }

  if (frame.ask) {
    const askCell = frame.cellsById[frame.ask.cellId]
    if (isCell) {
      const cell = frame.cellsById[pick]
      if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
      return {
        ok: false,
        message: `这一步先回答边界决策：${askCell.value}（${askCell.id}）进入前，合法区间要不要收紧。`,
      }
    }
    if (pick === 'bound-update') return { ok: true, message: '' }
    return {
      ok: false,
      message: `路径没错，是边界决策错了：不收紧界 = 退化成父子比较，C 组就会漏 —— 7 在 5 的左子树、继承上界 5，只和父节点 4 比是抓不到 7 > 5 的。`,
    }
  }

  // 格子决策帧
  if (isBound) {
    const target = frame.clickable[0]
    return {
      ok: false,
      message: `现在不是边界决策的时候：该点 ${target ? descOf(frame.cellsById[target], frame.cellsById) : '下一个格子'}（进入它）。`,
    }
  }
  const cell = frame.cellsById[pick]
  if (!cell) return { ok: false, message: `画布上没有 ${pick} 这一格。` }
  if (frame.clickable[0] === pick) return { ok: true, message: '' }

  const target = frame.clickable[0]
  const targetCell = frame.cellsById[target]
  // 空格轮点实格：优先点名（本题空格轮出现时真实格可能都已判完）
  if (targetCell && targetCell.empty && !cell.empty) {
    return {
      ok: false,
      message: `现在是空格轮：先点 ${descOf(targetCell, frame.cellsById)} 确认这里没有节点（返回合法）—— ${descOf(cell, frame.cellsById)} 不在这轮。`,
    }
  }
  if (frame.judgedIds.includes(pick)) {
    return { ok: false, message: '它已经在答案里了（已判定）。' }
  }
  return {
    ok: false,
    message: `现在进不去 ${descOf(cell, frame.cellsById)}：中序按 x 从左到右，先走 ${descOf(targetCell, frame.cellsById)}。`,
  }
}
