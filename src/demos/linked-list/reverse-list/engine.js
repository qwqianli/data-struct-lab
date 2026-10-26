/**
 * 反转链表（206）的教学引擎。
 *
 * 和二分查找同一套范式：纯函数、无 Vue 依赖，
 * 全部状态由「初始数据 + 每轮答对的决策序列（picks）」重放得出。
 *
 * 每轮只有第一步交给用户决策（正确答案永远是「先存 next」），
 * 答对后引擎自动补完剩下两步、产出 3 帧。
 * 答错的校验与反馈是 checkPick 的职责；buildFrames 遇到不匹配的 pick
 * 一律静默跳过、不产帧、不报错 —— 和其它演示保持一致。
 */

export const DEFAULT_VALUES = [1, 2, 3, 4, 5]

export const ACTIONS = {
  SAVE_NEXT: 'save-next', // next = cur.next
  RELINK: 'relink', // cur.next = prev
  ADVANCE: 'advance', // prev = cur; cur = next
}

const ACTION_LABELS = {
  [ACTIONS.SAVE_NEXT]: '先把 cur.next 存进 next',
  [ACTIONS.RELINK]: '让 cur 的箭头掉头指向 prev',
  [ACTIONS.ADVANCE]: 'prev、cur 先右移一位',
}

/**
 * 出一道选择题。选项按轮数轮转排列：正确答案不能永远停在同一个位置，
 * 用轮转而不是随机，是为了同一份 picks 永远复现出同一组选项顺序。
 */
function makeAsk(round) {
  const base = [ACTIONS.SAVE_NEXT, ACTIONS.RELINK, ACTIONS.ADVANCE]
  const rotated = base.map((_, k) => base[(k + round) % base.length])
  return {
    prompt: `第 ${round + 1} 轮的第一步该做哪个？`,
    options: rotated.map((action) => ({ action, label: ACTION_LABELS[action] })),
  }
}

/**
 * 指针列表怎么进帧：prev / cur / next 全程保留（悬空的以 at:null 表示，
 * 渲染器会在左下角画「prev = ∅」）；只有反转完成时只剩 prev ——
 * 那一刻 cur、next 都已经走出链表，留着只会误导。
 */
function pointerList(state) {
  const at = (index) => (index === null ? null : `n${index}`)
  if (state.done) return [{ name: 'prev', at: at(state.prev) }]
  return [
    { name: 'prev', at: at(state.prev) },
    { name: 'cur', at: at(state.cur) },
    { name: 'next', at: at(state.next) },
  ]
}

/**
 * 高亮跟着「谁正在被加工」走：cur 永远是 active；
 * 完成帧所有节点转 ok —— 绿节点配绿边，整条链掉头的结果一眼可辨。
 */
function highlightsOf(state) {
  if (state.done) {
    const all = {}
    state.nodes.forEach((n) => {
      all[n.id] = 'ok'
    })
    return all
  }
  return state.cur === null ? {} : { [`n${state.cur}`]: 'active' }
}

/**
 * 把当前状态拍成一份帧。nodes / links / pointers 都现场拷贝 ——
 * 帧会被视图直接当 props 用，绝不能和引擎的内部状态共享引用。
 */
function snapshot(state, { ask, caption, hint }) {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    links: state.nextOf.map((to, i) => ({
      from: `n${i}`,
      to: to === null ? null : `n${to}`,
      kind: state.relinked.has(i) ? 'reversed' : 'normal',
    })),
    pointers: pointerList(state),
    highlights: highlightsOf(state),
    ask,
    round: state.round,
    done: state.done,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{values?: number[], picks?: string[]}} options picks 是用户每轮选中的动作名序列
 * @returns {Frame[]}
 */
export function buildFrames({ values = DEFAULT_VALUES, picks = [] } = {}) {
  const emptyState = {
    nodes: [],
    nextOf: [],
    relinked: new Set(),
    prev: null,
    cur: null,
    next: null,
    round: 0,
    done: true,
  }
  if (values.length === 0) {
    return [
      snapshot(emptyState, {
        ask: null,
        caption: '空链表无需反转：一个节点都没有，新的头就是 ∅。',
        hint: '换一组至少 1 个节点的数据再来练。',
      }),
    ]
  }

  const state = {
    nodes: values.map((value, i) => ({ id: `n${i}`, value })),
    // nextOf 存的是下标而不是 id：引擎里一切定位都用下标，只有进帧那一刻才转成 id
    nextOf: values.map((_, i) => (i + 1 < values.length ? i + 1 : null)),
    relinked: new Set(),
    prev: null,
    cur: 0,
    next: null,
    round: 0,
    done: false,
  }

  const frames = [
    snapshot(state, {
      ask: makeAsk(0),
      caption: `链表 ${values.join('→')}。prev 悬空，cur 指向头节点 ${values[0]}。每一轮都要动三根指针。`,
      hint: '先想一个问题：如果把 cur 的箭头立刻改掉，后半条链还能找回来吗？',
    }),
  ]

  for (const pick of picks) {
    if (state.cur === null) break // 多余的 pick：已经完成，直接忽略
    if (pick !== ACTIONS.SAVE_NEXT) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    pushRound(frames, state)
  }
  return frames
}

/**
 * 补完一轮的 3 帧：存 next → 改箭头 → 挪指针。
 * 只有第一步交给用户；后两步顺序是既定的，直接演示出来。
 */
function pushRound(frames, state) {
  pushSaveNextFrame(frames, state)
  pushRelinkFrame(frames, state)
  pushAdvanceFrame(frames, state)
}

function pushSaveNextFrame(frames, state) {
  state.next = state.nextOf[state.cur]
  frames.push(
    snapshot(state, {
      ask: null,
      caption:
        state.next === null
          ? `next 存下 ∅ —— cur 已经是最后一个节点，后半条本来就没有东西。现在可以放心动箭头。`
          : `next 指向 ${state.nodes[state.next].value}。后半条链有人记住了，现在可以动 cur 的箭头。`,
      hint: '箭头一改就回不了头 —— 点「继续」之前想清楚：cur.next 现在被谁记着。',
    }),
  )
}

function pushRelinkFrame(frames, state) {
  const curValue = state.nodes[state.cur].value
  const prevBefore = state.prev
  state.nextOf[state.cur] = state.prev
  state.relinked.add(state.cur)
  frames.push(
    snapshot(state, {
      ask: null,
      caption:
        prevBefore === null
          ? `${curValue} 的箭头掉头指向 ∅（因为 prev 还是空的）。这是第一条断开的边。`
          : `${curValue} 的箭头掉头指向 ${state.nodes[prevBefore].value}。这条边已经掉头，变成绿色。`,
      hint: '改箭头永远排在存 next 之后 —— 顺序换过来，链就断了。',
    }),
  )
}

function pushAdvanceFrame(frames, state) {
  state.prev = state.cur
  state.cur = state.next
  state.next = null // next 只在帧 1~2 之间有意义，挪完指针就还回去
  state.round += 1
  state.done = state.cur === null

  const extras = state.done
    ? {
        ask: null,
        caption: `${state.nodes.length} 个节点全部走完，整条链掉头。现在 prev 指向 ${state.nodes[state.prev].value} —— 它就是新的头节点。`,
        hint: '点「重来」再走一遍：这次先自己说出三个动作的顺序，再动手。',
      }
    : {
        ask: makeAsk(state.round),
        caption: `prev 挪到 ${state.nodes[state.prev].value}，cur 挪到 ${state.nodes[state.cur].value}。下一轮重复同样的三个动作。`,
        hint: '三个动作里只有一步能先做 —— 另外两步先做，不是丢链就是绕路。',
      }
  frames.push(snapshot(state, extras))
}

/**
 * 校验一次决策。三种回答的反馈性质必须完全不同：
 * 答对、致命（会弄丢后半条链）、不致命但绕路（顺序错了）。
 * @param {Frame} frame
 * @param {string} action
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经反转完成，点「重来」再练一次。' }
  if (!Object.values(ACTIONS).includes(action)) return { ok: false, message: '这不是一个合法操作。' }
  if (frame.ask === null) return { ok: false, message: '现在不在决策点。' }

  if (action === ACTIONS.SAVE_NEXT) return { ok: true, message: '' }
  if (action === ACTIONS.RELINK) return relinkFeedback(frame)
  return advanceFeedback()
}

/**
 * RELINK 为什么致命：此刻没有任何变量替你记着 cur.next 指向谁，
 * 一改写，从 cur 往后的整段就永久找不回来了。文案要点名具体是哪条边会断。
 */
function relinkFeedback(frame) {
  const curId = frame.pointers.find((p) => p.name === 'cur').at
  const curValue = frame.nodes.find((n) => n.id === curId).value
  const outgoing = frame.links.find((l) => l.from === curId)
  const nextNode = outgoing && outgoing.to ? frame.nodes.find((n) => n.id === outgoing.to) : null

  if (nextNode) {
    return {
      ok: false,
      message: `不行。此刻只有 cur.next 还记着 ${nextNode.value} 在哪，你一改箭头，从 ${curValue} 往后就再也找不到路了 —— 后半条链会当场丢失。先把 cur.next 存进 next。`,
    }
  }
  // cur 已是最后一个节点的情形：没有链可丢，但三步的顺序仍然不能乱
  return {
    ok: false,
    message: `cur 已经是最后一个节点，cur.next 是 ∅。虽然没有链会丢，也要先把 ∅ 存进 next —— 三步的节奏一乱，写进代码里就是回头补丁。`,
  }
}

function advanceFeedback() {
  return {
    ok: false,
    message: '顺序反了。移动指针不会弄坏链，但它必须排在「改完 cur 的箭头」之后 —— 否则你会把 prev 挪到一个箭头还没掉头的节点上，下一轮还得回头补。',
  }
}
