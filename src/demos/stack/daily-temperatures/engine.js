/**
 * 每日温度（739）的教学引擎。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、非法 pick 静默跳过。
 *
 * 每轮只有一个决策：当前天比栈顶暖 → 弹；否则 → 压。
 * 答对后引擎自动补完这一轮的剩余弹出再压入，共产「弹出次数 + 1」帧 ——
 * 每一次弹出都要单独留帧，让学习者看见「弹 4、又弹 3」是两个动作。
 *
 * 教学核心：栈里存的是**下标**不是温度，答案算的是**下标之差** ——
 * ans[2] = 6 − 2 = 4 的意思是「第 2 天之后等了 4 天」，不是 76 − 75。
 */

export const DEFAULT_TEMPS = [73, 74, 75, 71, 69, 72, 76, 73]

/** 本轮该弹还是该压：栈空没得比只能压；比栈顶暖就弹（它等到更暖的天了）。 */
function expectedAction(state) {
  if (state.stack.length === 0) return 'push'
  const top = state.stack[state.stack.length - 1]
  return state.temps[state.cursor] > top.temp ? 'pop' : 'push'
}

/** 拍一帧现场快照，集合类字段现场拷贝，不和引擎内部状态共享引用。 */
function snapshot(state, { caption, hint }) {
  return {
    temps: [...state.temps],
    answers: [...state.answers],
    cursor: state.cursor,
    stack: state.stack.map((s) => ({ ...s })),
    phase: state.phase,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{temps?: number[], picks?: string[]}} options
 *        picks 是用户每轮选的动作：'pop' | 'push'
 * @returns {Frame[]}
 */
export function buildFrames({ temps = DEFAULT_TEMPS, picks = [] } = {}) {
  const state = {
    temps,
    answers: temps.map(() => null),
    cursor: 0,
    stack: [],
    phase: 'ask',
  }

  if (temps.length === 0) {
    state.phase = 'done'
    return [
      snapshot(state, {
        caption: '没有气温数据，答案就是空的。',
        hint: '换一组数据再练。',
      }),
    ]
  }

  const frames = [
    snapshot(state, {
      caption: `${temps.length} 天的气温。为每一天找出「几天后会更暖」，找不到就是 0。栈里放的是下标，不是温度。`,
      hint: `第 0 天 ${temps[0]}° 进栈。它现在在等一个比 ${temps[0]} 更高的温度。`,
    }),
  ]

  // 第 0 轮栈是空的，没有可比的对象、也没有决策可言：自动压入
  autoPushFirst(frames, state)

  for (const pick of picks) {
    if (state.phase === 'done') break // 多余的 pick：已经走完，忽略
    if (pick !== expectedAction(state)) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    playRound(frames, state)
  }
  return frames
}

/** 栈空时的第一压没有决策，直接产一帧（每一轮都以压入收尾，之后栈再也不会空）。 */
function autoPushFirst(frames, state) {
  const i = state.cursor
  state.stack.push({ id: `s${i}`, index: i, temp: state.temps[i] })
  state.cursor += 1
  if (state.cursor === state.temps.length) {
    finishAtPush(frames, state, `栈里只有这 ${state.temps.length} 天，压完就结束了。`)
    return
  }
  frames.push(
    snapshot(state, {
      caption: `栈空了，先把第 0 天 ${state.temps[0]}° 压进去，让它自己等。`,
      hint: `下一个是第 ${state.cursor} 天 ${state.temps[state.cursor]}°：和栈顶比比谁高。`,
    }),
  )
}

/**
 * 打完一整轮：先弹出所有比当前天冷（含相等）的栈顶、每次弹出一帧，
 * 再压入当前下标。走完最后一天时就地收尾：栈里剩下的答案全是 0。
 */
function playRound(frames, state) {
  const i = state.cursor
  const t = state.temps[i]
  let firstPop = true

  while (state.stack.length > 0 && t > state.stack[state.stack.length - 1].temp) {
    const top = state.stack.pop()
    state.answers[top.index] = i - top.index
    frames.push(snapshot(state, popExtras(state, i, t, top, firstPop)))
    firstPop = false
  }

  state.stack.push({ id: `s${i}`, index: i, temp: t })
  state.cursor += 1
  if (state.cursor === state.temps.length) {
    finishAtPush(frames, state, pushCaption(state, i, t))
    return
  }
  frames.push(
    snapshot(state, {
      caption: pushCaption(state, i, t),
      hint: `下一个是第 ${state.cursor} 天 ${state.temps[state.cursor]}°：它比栈顶 ${t}° 暖吗？`,
    }),
  )
}

function popExtras(state, i, t, top, firstPop) {
  const answer = `${i}−${top.index}=${i - top.index}`
  if (firstPop) {
    return {
      caption: `第 ${i} 天 ${t}° 比栈顶第 ${top.index} 天 ${top.temp}° 暖 —— 第 ${top.index} 天等到了，答案是 ${answer}。弹出它。`,
      hint: '答案是两个下标之差（等了几天），不是温度之差。',
    }
  }
  return {
    caption: `还没完：${t}° 也比第 ${top.index} 天的 ${top.temp}° 暖，第 ${top.index} 天也等到了，答案是 ${i}−${top.index}=${i - top.index}。`,
    hint: '同一个暖天可以「结账」好几个 colder 的天 —— 这就是为什么一轮可能弹好几次。',
  }
}

/** 压入帧的解说词。注意这帧拍在压入之后：栈顶-2 才是它进来前的旧栈顶；弹空则没有旧栈顶。 */
function pushCaption(state, i, t) {
  if (state.stack.length === 1) {
    return `第 ${i} 天 ${t}° 把栈弹空了 —— 压进去自己等，现在栈里只有它。`
  }
  const below = state.stack[state.stack.length - 2]
  return `${t}° 还是比栈顶第 ${below.index} 天的 ${below.temp}° 冷，压进去自己等。栈里从底到顶温度递减 —— 这是单调栈的关键。`
}

/** 最后一压即收尾：栈里剩下的下标永远等不到更暖，答案填 0，整帧置 done。 */
function finishAtPush(frames, state, baseCaption) {
  state.stack.forEach((s) => {
    if (state.answers[s.index] === null) state.answers[s.index] = 0
  })
  state.phase = 'done'
  const remain = state.stack.map((s) => `${s.temp}°`).join('、')
  frames.push(
    snapshot(state, {
      caption: `${baseCaption}整串走完：剩下栈里的 ${remain}，后面再没有更暖的日子，答案是 0。`,
      hint: '对照「栈里从底到顶递减」：没能被弹掉的，就是一辈子没等到的。',
    }),
  )
}

/**
 * 校验一次「弹 / 压」的决策。错误的反馈要讲清「为什么此刻只能这么做」。
 * @param {Frame} frame
 * @param {string} action 'pop' | 'push'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.phase === 'done') return { ok: false, message: '已经走完了，点「重来」再练一次。' }
  if (action !== 'pop' && action !== 'push') return { ok: false, message: '这不是一个合法动作。' }

  const top = frame.stack.length > 0 ? frame.stack[frame.stack.length - 1] : null
  if (top === null) {
    if (action === 'push') return { ok: true, message: '' }
    return { ok: false, message: '栈是空的，没有可以弹的东西 —— 只能先把当前下标压进去。' }
  }

  const i = frame.cursor
  const t = frame.temps[i]
  if (t > top.temp) {
    if (action === 'pop') return { ok: true, message: '' }
    return {
      ok: false,
      message: `栈顶是第 ${top.index} 天 ${top.temp}°，当前第 ${i} 天 ${t}° 比它高 —— 它终于等到更暖的天了，答案就是 ${i}−${top.index}=${i - top.index}。这时候把 ${t}° 压进去，第 ${top.index} 天就被埋在下面，它的答案再也算不出来。`,
    }
  }
  if (action === 'push') return { ok: true, message: '' }
  return {
    ok: false,
    message: `当前第 ${i} 天 ${t}° 不比栈顶第 ${top.index} 天 ${top.temp}° 高 —— 弹出来也解决不了它的问题（它还是没等到更暖），而且弹掉会把它的位置丢掉。应该压入，让 ${t}° 自己排进去等。`,
  }
}
