/**
 * 有效的括号（20）的教学引擎。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、非法 pick 静默跳过。每次正确决策产 1 帧。
 *
 * 每轮的正确答案由三条互斥规则给出：
 * ① 左括号 → push（它的右半边还在后面，无从比对）
 * ② 右括号且栈顶配对 → pop
 * ③ 右括号但栈空 / 栈顶不配对，或根本不是括号 → 立刻判 invalid
 * 第三条是本演示的教学核心：学习者最容易犯「碰到右括号就弹」的错，
 * invalid 这个选项的存在就是为了让那个错误有地方暴露。
 */

export const DEFAULT_TEXT = '([{}])'
export const INVALID_TEXT = '([)]'

const RIGHT_OF = { '(': ')', '[': ']', '{': '}' }
const LEFT_OF = { ')': '(', ']': '[', '}': '{' }

const DONE_HINT = '点「重来」从第一步再看一遍，注意错在哪一步。'

function isLeft(ch) {
  return ch in RIGHT_OF
}

function isRight(ch) {
  return ch in LEFT_OF
}

/** 当前字符该做的动作。三条规则互斥；非括号字符也走第三条（不可能是括号）。 */
function expectedAction(text, cursor, stack) {
  const ch = text[cursor]
  if (isLeft(ch)) return 'push'
  const top = stack.length > 0 ? stack[stack.length - 1].value : null
  return top !== null && LEFT_OF[ch] === top ? 'pop' : 'invalid'
}

/** 拍一帧现场快照，集合类字段现场拷贝，不和引擎内部状态共享引用。 */
function snapshot(state, { caption, hint }) {
  return {
    text: state.text,
    chars: state.chars.map((c) => ({ ...c })),
    cursor: state.cursor,
    stack: state.stack.map((s) => ({ ...s })),
    phase: state.phase,
    valid: state.valid,
    reason: state.reason,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{text?: string, picks?: string[]}} options
 *        picks 是用户每轮选的动作：'push' | 'pop' | 'invalid'
 * @returns {Frame[]}
 */
export function buildFrames({ text = DEFAULT_TEXT, picks = [] } = {}) {
  const state = {
    text,
    chars: [...text].map((ch, i) => ({ id: `c${i}`, ch, consumed: false })),
    cursor: 0,
    stack: [],
    phase: 'ask',
    valid: null,
    reason: '',
  }

  if (text.length === 0) {
    state.phase = 'done'
    state.valid = true
    return [
      snapshot(state, {
        caption: '空串：没有字符要检查，栈也从未用到 —— 直接有效。',
        hint: '换一组有内容的再练。',
      }),
    ]
  }

  const frames = [initialFrame(state)]
  for (const pick of picks) {
    if (state.phase === 'done') break // 多余的 pick：已经结束，忽略
    if (pick !== expectedAction(state.text, state.cursor, state.stack)) continue // 答错不产帧
    applyAction(frames, state)
  }
  return frames
}

function initialFrame(state) {
  const first = state.text[0]
  let hint
  if (isLeft(first)) hint = `第 1 个字符是 ${first} —— 左括号能做的只有一件事：先压栈。`
  else if (isRight(first)) hint = `第 1 个字符是 ${first} —— 栈是空的，它没有可配对的左半边。`
  else hint = `第 1 个字符是 ${first} —— 它不是括号。`
  return snapshot(state, {
    caption: `输入串 ${state.text} 从左往右读。栈里放的是「还没等到右半边」的左括号。`,
    hint,
  })
}

/** 执行一次答对的动作并产帧。 */
function applyAction(frames, state) {
  const action = expectedAction(state.text, state.cursor, state.stack)
  if (action === 'push') applyPush(frames, state)
  else if (action === 'pop') applyPop(frames, state)
  else applyInvalid(frames, state)
}

function applyPush(frames, state) {
  const ch = state.text[state.cursor]
  state.stack.push({ id: `s${state.cursor}`, value: ch })
  state.chars[state.cursor].consumed = true
  // 压栈只会加深栈：如果这一压恰好读完整串，栈里必然有剩 —— 留给读完判定去说
  advance(frames, state, `${ch} 入栈。栈顶现在是它，它在等一个 ${RIGHT_OF[ch]}。`)
}

function applyPop(frames, state) {
  const ch = state.text[state.cursor]
  const top = state.stack.pop()
  state.chars[state.cursor].consumed = true
  advance(frames, state, `读到的 ${ch} 和栈顶的 ${top.value} 配上了，把它弹掉。剩下的继续等。`)
}

/**
 * 消费当前字符、cursor 前进一格；若串也就此读完，就地给出终局帧：
 * 栈空 → 有效；栈里还有 → 无效（它们的右半边永远等不来了）。
 */
function advance(frames, state, moveCaption) {
  state.cursor += 1
  if (state.cursor < state.text.length) {
    frames.push(snapshot(state, { caption: moveCaption, hint: nextHint(state) }))
    return
  }

  if (state.stack.length === 0) {
    state.phase = 'done'
    state.valid = true
    frames.push(
      snapshot(state, {
        caption: `${state.text.length} 个字符读完，栈空。每一个右括号都找到了它的左半边，这就是有效。`,
        hint: '点「重来」，切到另一组数据对照着看。',
      }),
    )
    return
  }

  const remain = state.stack.map((s) => s.value).join(' ')
  state.phase = 'done'
  state.valid = false
  state.reason = `串读完时栈里还剩 ${remain} —— 没等到它们的右半边。`
  frames.push(
    snapshot(state, {
      caption: `字符串读完了，但栈里还剩 ${remain} —— 它们的右半边一直没来。（比如 (() 就是这样）`,
      hint: DONE_HINT,
    }),
  )
}

/** 立刻判无效。三种触发：右括号遇栈空、右括号与栈顶不配对、字符根本不是括号。 */
function applyInvalid(frames, state) {
  const ch = state.text[state.cursor]
  const where = state.cursor + 1
  const top = state.stack.length > 0 ? state.stack[state.stack.length - 1].value : null
  state.phase = 'done'
  state.valid = false

  if (!isLeft(ch) && !isRight(ch)) {
    state.reason = `第 ${where} 个字符 ${ch} 不是括号。`
    frames.push(
      snapshot(state, {
        caption: `读到的 ${ch} 根本不是括号 —— 这串输入不合法，立刻判无效。`,
        hint: DONE_HINT,
      }),
    )
    return
  }

  if (top === null) {
    state.reason = `第 ${where} 个字符 ${ch} 前面没有可配对的左括号（栈是空的）。`
    frames.push(
      snapshot(state, {
        caption: `读到的 ${ch} 要配 ${LEFT_OF[ch]}，可栈是空的 —— 它的左半边从来没来过。立刻判无效。`,
        hint: DONE_HINT,
      }),
    )
    return
  }

  state.reason = `第 ${where} 个字符 ${ch} 与栈顶 ${top} 不配对。`
  frames.push(
    snapshot(state, {
      caption: `读到的 ${ch} 要配 ${LEFT_OF[ch]}，可栈顶是 ${top}。已经配不上了 —— 再往下读也没救，立刻判无效。`,
      hint: DONE_HINT,
    }),
  )
}

/** 非终局帧的统一提示：预告下一个字符该按哪条规则想。 */
function nextHint(state) {
  const ch = state.text[state.cursor]
  if (isLeft(ch)) return `下一个是 ${ch}（左括号）—— 只能压栈，等它的右半边。`
  if (isRight(ch)) return `下一个是 ${ch}（右括号）—— 看栈顶是不是 ${LEFT_OF[ch]}：是就弹，不是就已经没救。`
  return `下一个是 ${ch} —— 它不是括号。`
}

/**
 * 校验一次「压 / 弹 / 判无效」的决策。错误的反馈要讲清「为什么这条路走不通」。
 * @param {Frame} frame
 * @param {string} action 'push' | 'pop' | 'invalid'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.phase === 'done') return { ok: false, message: '已经判定完成，点「重来」再练一次。' }
  if (action !== 'push' && action !== 'pop' && action !== 'invalid') {
    return { ok: false, message: '这不是一个合法动作。' }
  }

  const ch = frame.text[frame.cursor]
  const top = frame.stack.length > 0 ? frame.stack[frame.stack.length - 1].value : null
  const expected = expectedAction(frame.text, frame.cursor, frame.stack)
  if (action === expected) return { ok: true, message: '' }

  if (expected === 'push') {
    return {
      ok: false,
      message: `当前字符 ${ch} 是左括号 —— 它的右半边还在后面，现在无从比对，只能先压栈。`,
    }
  }
  if (expected === 'pop') {
    if (action === 'push') {
      return { ok: false, message: `当前是右括号 ${ch}，右括号不能入栈 —— 栈顶的 ${LEFT_OF[ch]} 正等着它配对，弹出即可。` }
    }
    return { ok: false, message: `栈顶的 ${top} 和当前 ${ch} 正好配对 —— 没必要判无效，弹掉它继续往下读。` }
  }

  // 该判无效的三种情况，按触发原因分别说清「为什么弹 / 压都救不了」
  if (action === 'pop') {
    if (top === null) {
      return { ok: false, message: `栈是空的，没有东西可弹 —— ${ch} 的左半边 ${LEFT_OF[ch]} 从来没出现过。只能当场判无效。` }
    }
    if (!isRight(ch)) {
      return { ok: false, message: `${ch} 不是括号，弹栈解决不了「输入本身就不合法」的问题。直接判无效。` }
    }
    return {
      ok: false,
      message: `栈顶是 ${top}，你要配的是 ${ch} —— 这两个凑不成一对。这时弹出只会掩盖问题：栈顶换掉之后看似又能继续，但把 ${top} 丢掉等于假装它配对成功。正确做法是当场判无效。`,
    }
  }

  // action === 'push' 而该判无效
  if (!isLeft(ch) && !isRight(ch)) {
    return { ok: false, message: `${ch} 不是括号，不能入栈。直接判无效。` }
  }
  return { ok: false, message: `当前是右括号 ${ch}，它不能入栈；而栈顶又不是 ${LEFT_OF[ch]} —— 已经配不上，判无效。` }
}
