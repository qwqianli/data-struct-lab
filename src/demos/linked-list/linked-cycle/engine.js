/**
 * 环形链表（141）的教学引擎。
 *
 * 范式与 206 相同：纯函数、无 Vue 依赖、状态用下标，
 * 帧序列由「初始数据 + 每轮答对的落点序列（picks）」重放得出。
 *
 * 每轮只有一个问题交给用户：fast 走 2 步会落在哪里。
 * fast 每轮走 2 步、slow 走 1 步，净追 1 步 —— 这个「净追 1」
 * 是「有环必然相遇」的全部依据：在环里差距只减不增，迟早归零。
 */

export const DEFAULT_VALUES = [3, 2, 0, -4]
export const DEFAULT_POS = 1
export const NO_CYCLE_POS = -1

/**
 * 「fast 走出链表」这个答案的 pick 值。
 * 无环链表的最后一轮，正确答案不是任何节点 —— 没有这个哨兵值，
 * 「无环」这种情况就没法作答，演示会永远卡在最后一问上。
 */
export const OUT = 'out'

/**
 * 从 start 走 k 步，中途遇到 null 就停下并返回 null。
 * 这不是防御性编程：无环正是本演示要演示的第二种情况，
 * fast 踩空是必经路径而不是异常路径，直接写 next.next 会在 pos=-1 上抛 TypeError。
 */
function walk(nextOf, start, k) {
  let cur = start
  for (let i = 0; i < k && cur !== null; i += 1) {
    cur = nextOf[cur]
  }
  return cur
}

/** 本轮的正确答案：fast 走 2 步的落点，走出链表时是 OUT。 */
function landingPick(state) {
  const landing = walk(state.nextOf, state.fast, 2)
  return landing === null ? OUT : `n${landing}`
}

/**
 * 拍一帧现场快照。nodes / links / pointers 都现场拷贝，
 * 帧会被视图直接当 props 用，不能和引擎内部状态共享引用。
 * links 的 kind 一律 normal：回指边靠 ListCanvas 的下方绕行形态区分，
 * 'reversed' 的语义是「反转过的边」，用在这里会误导。
 */
function snapshot(state, { ask = null, caption, hint }) {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    links: state.nextOf.map((to, i) => ({
      from: `n${i}`,
      to: to === null ? null : `n${to}`,
      kind: 'normal',
    })),
    pointers: [
      { name: 'slow', at: state.slow === null ? null : `n${state.slow}` },
      { name: 'fast', at: state.fast === null ? null : `n${state.fast}` },
    ],
    highlights: highlightsOf(state),
    ask,
    round: state.round,
    done: state.done,
    met: state.met,
    caption,
    hint,
  }
}

/**
 * slow / fast 各自所在的节点保持 active，让「两个跑者」一眼可辨；
 * 相遇帧把见面节点标成 ok —— slow 和 fast 落在同一节点上，一个 ok 同时代表两者。
 */
function highlightsOf(state) {
  if (state.done && state.met) return { [`n${state.fast}`]: 'ok' }
  const h = {}
  if (state.slow !== null) h[`n${state.slow}`] = 'active'
  if (state.fast !== null) h[`n${state.fast}`] = 'active'
  return h
}

/**
 * 重放出完整帧序列。
 * @param {{values?: number[], pos?: number, picks?: string[]}} options
 *        pos 为 -1 表示无环；picks 是用户每轮点中的节点 id 序列（走出链表答案是 OUT）
 * @returns {Frame[]}
 */
export function buildFrames({ values = DEFAULT_VALUES, pos = DEFAULT_POS, picks = [] } = {}) {
  if (values.length === 0) {
    const empty = { nodes: [], nextOf: [], slow: null, fast: null, round: 0, done: true, met: false }
    return [
      snapshot(empty, {
        caption: '空链表：一个节点都没有，没有环可言。',
        hint: '换一组至少 1 个节点的数据再练。',
      }),
    ]
  }

  // 尾节点连回 pos 就是环；pos = -1 时尾节点正常指向 ∅
  const tailBack = pos >= 0 && pos < values.length ? pos : null
  const state = {
    nodes: values.map((value, i) => ({ id: `n${i}`, value })),
    nextOf: values.map((_, i) => (i + 1 < values.length ? i + 1 : tailBack)),
    slow: 0,
    fast: 0,
    round: 0,
    done: false,
    met: false,
  }

  const frames = [
    snapshot(state, {
      ask: { prompt: '第 1 轮：fast 走 2 步会落在哪里？在画布里点那个节点。' },
      caption:
        tailBack === null
          ? `链表 ${values.join('→')}。slow 和 fast 都从头出发。`
          : `链表 ${values.join('→')}，尾巴又连回了第 ${pos + 1} 个节点 —— 这是一个环。slow 和 fast 都从头出发。`,
      hint: 'fast 每轮走 2 步、slow 走 1 步。先算第 1 轮 fast 落在哪，再点它。',
    }),
  ]

  for (const pick of picks) {
    if (state.done) break // 多余的 pick：已经结束，忽略
    if (pick !== landingPick(state)) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    pushRound(frames, state)
  }
  return frames
}

/**
 * 补完一轮的 3 帧：slow 走 1 步 → fast 走 2 步 → 比较。
 * 只有 fast 的落点交给用户预测；slow 那 1 步没有决策价值，直接演示。
 */
function pushRound(frames, state) {
  pushSlowFrame(frames, state)
  pushFastFrame(frames, state)
  pushCompareFrame(frames, state)
}

function pushSlowFrame(frames, state) {
  state.slow = walk(state.nextOf, state.slow, 1)
  const caption =
    state.slow === null
      ? 'slow 走了 1 步 —— 这条链只有 1 个节点，它直接走出链表了。fast 还没动。'
      : `slow 走了 1 步，到 ${state.nodes[state.slow].value}。fast 还没动。`
  frames.push(
    snapshot(state, {
      caption,
      hint: 'fast 每轮比 slow 多走 1 步 —— 两个指针的差距就是这样一轮轮缩小的。',
    }),
  )
}

function pushFastFrame(frames, state) {
  const from = state.fast
  const step1 = state.nextOf[from]
  const step2 = step1 === null ? null : state.nextOf[step1]
  state.fast = step2
  frames.push(
    snapshot(state, {
      caption: fastCaption(state, from, step1, step2),
      hint: '盯住 fast 的路线：有环它就永远出不去，只会一圈圈贴着 slow 绕。',
    }),
  )
}

/**
 * fast 这一步的解说词。「绕回」是全场教学重点：第 2 步落点不比第 1 步更靠右，
 * 说明它踩上了回头路 —— 必须把「下一步不是空」这一点点破。
 */
function fastCaption(state, from, step1, step2) {
  const fromV = state.nodes[from].value
  if (step1 === null) return `fast 从 ${fromV} 出发，第 1 步就走出链表（到空）。`
  const s1V = state.nodes[step1].value
  if (step2 === null) return `fast 从 ${fromV} 走两步：先到 ${s1V}，再往前是空 —— 它走出链表了。`
  const s2V = state.nodes[step2].value
  if (step2 <= step1) {
    return `fast 从 ${fromV} 走两步：先到 ${s1V}，下一步不是空 —— 而是绕回了 ${s2V}。这条回头路就是环。`
  }
  return `fast 从 ${fromV} 走两步：经过 ${s1V}，落在 ${s2V}。`
}

function pushCompareFrame(frames, state) {
  state.round += 1
  if (state.fast === null) {
    // fast 先走出链表 = 没有环：跑得快的都到头了，说明没有回头路可走
    state.done = true
    state.met = false
    frames.push(
      snapshot(state, {
        caption: 'fast 走出了链表（走到空）。它跑得比 slow 快还先到头，说明这条链没有环。',
        hint: '对照「有环」那组数据：那边 fast 永远出不去，只会一圈圈追 slow。',
      }),
    )
    return
  }
  if (state.slow === state.fast) {
    state.done = true
    state.met = true
    frames.push(
      snapshot(state, {
        caption: `slow 和 fast 都落在 ${state.nodes[state.fast].value}。追上了 —— 有环。fast 每轮净追 1 步，所以只要有环，迟早会重合。`,
        hint: '点「重来」，切到「无环」那组数据对照着看一遍。',
      }),
    )
    return
  }
  frames.push(
    snapshot(state, {
      ask: { prompt: `第 ${state.round + 1} 轮：fast 走 2 步会落在哪里？在画布里点那个节点。` },
      caption: `第 ${state.round} 轮结束：slow 在 ${state.nodes[state.slow].value}，fast 在 ${state.nodes[state.fast].value}，还没相遇。`,
      hint: '下一轮 fast 又要跨 2 步 —— 先在脑子里替它走一遍，再点。',
    }),
  )
}

/**
 * 校验一次「fast 会落在哪」的点击。
 * @param {Frame} frame
 * @param {string} pick 用户点中的节点 id，或 OUT（预测 fast 走出链表）
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, pick) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经结束了，点「重来」再练一次。' }
  if (frame.ask === null) return { ok: false, message: '现在不在决策点。' }
  const nodeIds = frame.nodes.map((n) => n.id)
  if (pick !== OUT && !nodeIds.includes(pick)) return { ok: false, message: '这个节点不存在。' }

  const route = fastRoute(frame)
  const answer = route.step2 === null ? OUT : route.step2
  if (pick === answer) return { ok: true, message: '' }
  if (pick === OUT) return outFeedback(frame, route)
  if (pick === route.step1) return oneStepFeedback(frame, route)
  return wrongNodeFeedback(frame, route, pick)
}

/**
 * 从帧里复原 fast 的两步路线（下标 + id 都要）。
 * checkPick 只拿得到帧，next 关系要从 links 现查；
 * 「是否绕回」要用下标比大小，id 字符串在节点数 ≥ 10 时比不出大小。
 */
function fastRoute(frame) {
  const idx = new Map(frame.nodes.map((n, i) => [n.id, i]))
  const nextOf = new Map(frame.links.map((l) => [l.from, l.to]))
  const from = frame.pointers.find((p) => p.name === 'fast').at
  const step1 = nextOf.get(from)
  const step2 = step1 === null ? null : nextOf.get(step1)
  return {
    from,
    step1,
    step2,
    i1: step1 === null ? null : idx.get(step1),
    i2: step2 === null ? null : idx.get(step2),
  }
}

function valueOf(frame, id) {
  return frame.nodes.find((n) => n.id === id).value
}

/**
 * 把 fast 的两步走位翻成一句话。三种错误反馈共用同一段事实描述，
 * 保证不管点错什么，学习者听到的都是同一个口径。
 */
function routeText(frame, r) {
  const fromV = valueOf(frame, r.from)
  if (r.step1 === null) return `fast 从 ${fromV} 出发，第 1 步就是空（它正站在最后一个节点上）`
  const s1V = valueOf(frame, r.step1)
  if (r.step2 === null) return `fast 从 ${fromV} 出发：第 1 步到 ${s1V}，第 2 步走出链表（到空）`
  const verb = r.i2 <= r.i1 ? '绕回' : '到'
  return `fast 从 ${fromV} 出发：第 1 步到 ${s1V}，第 2 步${verb} ${valueOf(frame, r.step2)}`
}

/** 点了「走出链表」但 fast 其实落在一个节点上。 */
function outFeedback(frame, r) {
  const s1V = valueOf(frame, r.step1)
  const s2V = valueOf(frame, r.step2)
  const extra = r.i2 <= r.i1 ? `注意 ${s1V} 的 next 指回了 ${s2V}，这就是环的位置。` : 'fast 还在链上。'
  return {
    ok: false,
    message: `${routeText(frame, r)} —— 不是空。${extra}`,
  }
}

/** 点了走 1 步的落点：fast 每轮跨 2 步，差的那一步要补上。 */
function oneStepFeedback(frame, r) {
  if (r.step2 === null) {
    return {
      ok: false,
      message: '这是「走 1 步」的落点。fast 每轮走 2 步 —— 再往后一步就是空，它会走出链表。点「走出链表」。',
    }
  }
  return {
    ok: false,
    message: `这是「走 1 步」的落点。fast 每轮走 2 步，再往后一步才对 —— 那里是 ${valueOf(frame, r.step2)}。`,
  }
}

/** 点了别的节点：先讲清 fast 实际的两步，再点名正确答案和他点的地方。 */
function wrongNodeFeedback(frame, r, pick) {
  const answer = r.step2 === null ? '正确答案是「走出链表」' : `正确答案是「${valueOf(frame, r.step2)}」`
  return {
    ok: false,
    message: `${routeText(frame, r)}。${answer}，你点的是「${valueOf(frame, pick)}」。`,
  }
}
