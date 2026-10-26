/**
 * 滑动窗口最大值（239）的教学引擎。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、非法 pick 静默跳过。
 *
 * 决策模型：每个下标的处理分三步 —— ① 队首过期检查（引擎自动，发生在压入后
 * 窗口滑到新位置时）；② 弹不弹队尾（用户决策，能弹就继续问）；③ 压入当前
 * （决策完自动）。队列弹空时没有「还弹不弹」的问题，自动压入。
 *
 * 教学核心：队列里存的是下标，从队首到队尾对应的值越来越小 ——
 * 所以队首永远是当前窗口的最大值，不需要每轮扫一遍窗口。
 * queue 的顺序是**队首在前**（和栈的「底在前」相反），渲染时从左往右就是队头 → 队尾。
 */

export const DEFAULT_NUMS = [1, 3, -1, -3, 5, 3, 6, 7]
export const DEFAULT_K = 3

// 第二组数据专门负责「队首过期」：官方数据里队首从没掉出过窗口，
// 而 [5,3,1,2,4] 的第 4 个元素进来时，队首下标 0 刚好出界
export const EXPIRE_NUMS = [5, 3, 1, 2, 4]
export const EXPIRE_K = 3

/** 队尾该不该弹：当前值**严格大于**队尾的值才弹 —— 相等不弹（>= 会把还能当答案的等值误伤掉）。 */
function expectedAction(state) {
  const tail = state.queue[state.queue.length - 1]
  return tail && state.nums[state.cursor] > state.nums[tail.index] ? 'pop-tail' : 'push'
}

/** 拍一帧现场快照，集合类字段现场拷贝，不和引擎内部状态共享引用。 */
function snapshot(state, { caption, hint }) {
  return {
    nums: [...state.nums],
    k: state.k,
    cursor: state.cursor,
    queue: state.queue.map((q) => ({ ...q })),
    window: state.window === null ? null : { ...state.window },
    answers: [...state.answers],
    phase: state.phase,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], k?: number, picks?: string[]}} options
 *        picks 是用户每次的决策：'pop-tail' | 'push'（同一轮可能多次 pop-tail）
 * @returns {Frame[]}
 */
export function buildFrames({ nums = DEFAULT_NUMS, k = DEFAULT_K, picks = [] } = {}) {
  const state = {
    nums,
    k,
    cursor: 0,
    queue: [], // 队首在前：queue[0] 最早入队、也是当前窗口最大值的下标
    window: null,
    answers: [],
    phase: 'ask',
    popsThisRound: 0,
  }

  if (nums.length === 0 || k > nums.length) {
    state.phase = 'done'
    const why =
      nums.length === 0
        ? '数组是空的，没有窗口可言。'
        : `窗口（${k}）比数组（${nums.length} 个）还大，一个完整的窗口都装不出来。`
    return [snapshot(state, { caption: why, hint: '换一组数据再练。' })]
  }

  state.answers = Array(nums.length - k + 1).fill(null)
  const frames = [snapshot(state, initialExtras(state))]

  // 第 0 个：队列空，没有可比的对象，也没有决策 —— 直接压入（同 739 的首压）
  completeRound(frames, state)

  for (const pick of picks) {
    if (state.phase === 'done') break // 多余的 pick：已经走完，忽略
    if (pick !== expectedAction(state)) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    if (pick === 'pop-tail') applyPopTail(frames, state)
    else completeRound(frames, state)
  }
  return frames
}

function initialExtras(state) {
  return {
    caption: `数组 [${state.nums.join(', ')}]，窗口大小 ${state.k}。窗口往右滑，每次要回答「当前窗口里最大的是谁」。`,
    hint: '队列里放的是下标，从队头到队尾对应的值越来越小。所以队头永远是当前窗口的最大值。',
  }
}

/** 弹一次队尾并产帧；弹空了就没有下一步决策，直接压入收轮。 */
function applyPopTail(frames, state) {
  const tail = state.queue.pop()
  state.popsThisRound += 1
  frames.push(snapshot(state, popExtras(state, tail)))
  if (state.queue.length === 0) completeRound(frames, state)
}

/**
 * 压入当前下标并结算这一轮：窗口滑到以 i 结尾 →（若队首出界）单独留一帧「左出」→
 * 答案取队首的值。末轮就地置 done。
 */
function completeRound(frames, state) {
  const i = state.cursor
  const v = state.nums[i]
  const wasEmpty = state.queue.length === 0
  state.queue.push({ id: `q${i}`, index: i })
  state.cursor += 1
  state.popsThisRound = 0
  const doneNow = state.cursor === state.nums.length

  if (i < state.k - 1) {
    frames.push(snapshot(state, pushExtras(state, i, v, wasEmpty)))
    return
  }

  state.window = { left: i - state.k + 1, right: i }
  const front = state.queue[0]

  if (front.index >= state.window.left) {
    state.answers[state.window.left] = state.nums[front.index]
    if (doneNow) state.phase = 'done'
    frames.push(snapshot(state, answerExtras(state, i, v, wasEmpty, doneNow)))
    return
  }

  // 队首刚好掉出窗口：先留压入帧（队列还带着旧队首），再单独留一帧说清「左出」——
  // 这是第二组数据存在的全部意义，必须让学习者看见 [0,1,3] → [1,3] 这一步
  frames.push(snapshot(state, slideExtras(state, i, v, wasEmpty)))
  const out = state.queue.shift()
  state.answers[state.window.left] = state.nums[state.queue[0].index]
  if (doneNow) state.phase = 'done'
  frames.push(snapshot(state, expireExtras(state, out, doneNow)))
}

function pushExtras(state, i, v, wasEmpty) {
  const below = state.queue[state.queue.length - 2]
  const caption = wasEmpty
    ? `第 ${i} 个是 ${v}，队列空，直接压入 —— 它暂时就是最大的。`
    : `第 ${i} 个是 ${v}，不比队尾的 ${state.nums[below.index]} 大，压入 —— 等前面的滑出窗口，它可能就是新的最大值。`
  return { caption, hint: nextHint(state) }
}

function answerExtras(state, i, v, wasEmpty, doneNow) {
  const front = state.queue[0]
  const w = state.window
  let caption = `第 ${i} 个是 ${v}，压入后窗口滑到 [${w.left}, ${w.right}]：队头是 #${front.index}（${state.nums[front.index]}），这个窗口的最大值就是它 —— 不用扫整个窗口。`
  if (doneNow) {
    caption += ` 整串走完：${state.answers.length} 个窗口的最大值是 [${state.answers.join(', ')}]。队列从队头到队尾值递减，队头直接就是答案。`
  }
  return {
    caption,
    hint: doneNow ? '点「重来」，切到另一组数据看「队首过期」。' : nextHint(state),
  }
}

/** 压入帧（窗口已滑、队首还没移除）的解说词。 */
function slideExtras(state, i, v, wasEmpty) {
  const front = state.queue[0]
  const w = state.window
  return {
    caption: `第 ${i} 个是 ${v}，压入后窗口滑到 [${w.left}, ${w.right}] —— 注意队头 #${front.index}（值 ${state.nums[front.index]}）已经不在窗口里了。`,
    hint: '窗口右进左出：左出窗口的下标，要从队头移除。',
  }
}

/** 队首过期帧：第二组数据存在的唯一理由，必须把这半边机制说透。 */
function expireExtras(state, out, doneNow) {
  const w = state.window
  const front = state.queue[0]
  const answer = state.answers[w.left]
  let caption = `下标 #${out.index}（${state.nums[out.index]}）掉出了窗口 [${w.left}, ${w.right}]，从队头移除 —— 这就是「窗口右进左出」的左出。现在队头是 #${front.index}，这个窗口的最大值是 ${answer}。`
  if (doneNow) {
    caption += ` 整串走完：${state.answers.length} 个窗口的最大值是 [${state.answers.join(', ')}]。`
  }
  return { caption, hint: doneNow ? '点「重来」再走一遍。' : nextHint(state) }
}

function popExtras(state, tail) {
  const i = state.cursor
  const v = state.nums[i]
  const tv = state.nums[tail.index]
  if (state.popsThisRound === 1) {
    return {
      caption: `第 ${i} 个是 ${v}，比队尾的 ${tv}（#${tail.index}）大 —— ${tv} 永远不可能再当最大值了：它比 ${v} 小，还会比 ${v} 先出窗口。弹掉它。`,
      hint: `再看看新的队尾：${v} 还比它大吗？大就继续弹。`,
    }
  }
  return {
    caption: `还没完：${v} 也比队尾的 ${tv}（#${tail.index}）大，继续弹。`,
    hint: '队列从队头到队尾必须越来越小，队头才能始终是最大值。',
  }
}

function nextHint(state) {
  const tail = state.queue[state.queue.length - 1]
  return `下一个是第 ${state.cursor} 个 ${state.nums[state.cursor]}：它比队尾的 ${state.nums[tail.index]} 大吗？`
}

/**
 * 校验一次「弹队尾 / 压入」的决策。
 * @param {Frame} frame
 * @param {string} action 'pop-tail' | 'push'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.phase === 'done') return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (action !== 'pop-tail' && action !== 'push') return { ok: false, message: '这不是一个合法动作。' }

  const tail = frame.queue.length > 0 ? frame.queue[frame.queue.length - 1] : null
  if (tail === null) {
    if (action === 'push') return { ok: true, message: '' }
    return { ok: false, message: '队列是空的，没有队尾可弹 —— 只能把当前下标压进去。' }
  }

  const i = frame.cursor
  const v = frame.nums[i]
  const tv = frame.nums[tail.index]

  if (v > tv) {
    if (action === 'pop-tail') return { ok: true, message: '' }
    return {
      ok: false,
      message: `队尾是 ${tv}（#${tail.index}），当前第 ${i} 个是 ${v}，比它大 —— 留着 ${tv} 没有任何用处：它比 ${v} 小（永远不会成为最大值），又排在 ${v} 前面（会比 ${v} 先出窗口）。两条都占了，就是死路一条 —— 弹掉。`,
    }
  }
  if (action === 'push') return { ok: true, message: '' }
  return {
    ok: false,
    message: `当前第 ${i} 个是 ${v}，不比队尾的 ${tv} 大，弹掉它没道理：队尾比你大、还会比你晚出窗口，它才是更可能的答案。应该压入，让 ${v} 排在它后面等机会。`,
  }
}
