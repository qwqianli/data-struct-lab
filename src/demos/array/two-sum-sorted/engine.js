/**
 * 两数之和 II（167）的教学引擎。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、非法 pick 静默跳过。
 * 每轮只有 1 帧（和二分查找一样），决策是「该动 left 还是 right」。
 *
 * 教学核心是方向感：升序数组里 sum > target 只能收 right、sum < target 只能进 left
 * —— 因为只有这两个方向分别能让和变小 / 变大，其余方向都在背离目标。
 * 学习者记不住双指针，往往是因为没人告诉他「为什么是这个方向」。
 */

export const DEFAULT_NUMBERS = [2, 7, 11, 15]
export const DEFAULT_TARGET = 9

/** 该动的方向：和太大收右（减小最大值），和太小进左（换掉最小值）。 */
function correctDirection(state) {
  return state.sum > state.target ? 'right' : 'left'
}

/** 拍一帧现场快照，集合类字段现场拷贝，不和引擎内部状态共享引用。 */
function makeFrame(state, { caption, hint }) {
  return {
    numbers: [...state.numbers],
    target: state.target,
    left: state.left,
    right: state.right,
    sum: state.sum,
    eliminated: [...state.eliminated],
    found: state.found,
    dead: state.dead,
    picksCount: state.picksCount,
    caption,
    hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{numbers?: number[], target?: number, picks?: string[]}} options
 *        picks 是用户每轮选的方向：'left' 或 'right'
 * @returns {Frame[]}
 */
export function buildFrames({ numbers = DEFAULT_NUMBERS, target = DEFAULT_TARGET, picks = [] } = {}) {
  const state = {
    numbers,
    target,
    left: 0,
    right: Math.max(numbers.length - 1, 0),
    sum: 0,
    eliminated: [],
    found: false,
    dead: false,
    picksCount: 0,
  }

  // 元素不足两个：连「一对」都凑不出来，直接一帧结束
  if (numbers.length < 2) {
    state.dead = true
    return [
      makeFrame(state, {
        caption: '元素不足两个，构不成一对 —— 这道题没有起点。',
        hint: '换一组至少 2 个元素的数据再练。',
      }),
    ]
  }

  state.sum = numbers[state.left] + numbers[state.right]
  const frames = [initialFrame(state)]

  for (const pick of picks) {
    if (state.found || state.dead) break // 多余的 pick：已经结束，忽略
    if (pick !== correctDirection(state)) continue // 答错的 pick 不产帧，校验是 checkPick 的事
    applyMove(frames, state, pick)
  }
  return frames
}

function initialFrame(state) {
  const { numbers, target, left, right, sum } = state
  const base = `升序数组 [${numbers.join(', ')}]，要找两数之和等于 ${target}。left 指向最小的、right 指向最大的。`

  // 首对就命中：不需要任何决策，直接给结论帧
  if (sum === target) {
    state.found = true
    return makeFrame(state, {
      caption: `${base} 而第一对就正好：${numbers[left]} + ${numbers[right]} = ${sum}，命中。`,
      hint: '运气好的数据。点「重来」换一组需要推理的数据再练。',
    })
  }

  const diff = sum > target ? '大' : '小'
  return makeFrame(state, {
    caption: base,
    hint: `先算 ${numbers[left]} + ${numbers[right]} = ${sum}。${sum} 比 ${target} ${diff}，你打算动哪边？想清楚「动哪边能让和变${sum > target ? '小' : '大'}」。`,
  })
}

/**
 * 执行一次答对的移动并产帧。被越过的那个下标进 eliminated；
 * left / right 本身永远是候选，不算排除 —— 它们随时可能再被比较。
 */
function applyMove(frames, state, direction) {
  state.eliminated.push(direction === 'right' ? state.right : state.left)
  if (direction === 'right') state.right -= 1
  else state.left += 1
  state.picksCount += 1
  state.sum = state.numbers[state.left] + state.numbers[state.right]

  // left 追上 right：候选区压空，同一个元素不能和自己配对
  if (state.left >= state.right) {
    state.dead = true
    frames.push(
      makeFrame(state, {
        caption: `left 追上了 right，区间压空 —— 没有和等于 ${state.target} 的两个数。`,
        hint: '夹逼能把「不存在」也明确证出来：两头把所有可能都试遍了。',
      }),
    )
    return
  }

  if (state.sum === state.target) {
    state.found = true
    frames.push(makeFrame(state, foundExtras(state)))
    return
  }

  const a = state.numbers[state.left]
  const b = state.numbers[state.right]
  if (state.sum > state.target) {
    frames.push(
      makeFrame(state, {
        caption: `${a} + ${b} = ${state.sum} > ${state.target}，和太大了。右指针往左收才能把和压下去。`,
        hint: '升序数组里这个方向是唯一的：left 右移只会让和更大。',
      }),
    )
  } else {
    frames.push(
      makeFrame(state, {
        caption: `${a} + ${b} = ${state.sum} < ${state.target}，和太小了。只能让左指针往右进。`,
        hint: 'right 左移只会让和更小，离目标更远。',
      }),
    )
  }
}

function foundExtras(state) {
  const { numbers, left, right, sum, picksCount } = state
  const pairs = (numbers.length * (numbers.length - 1)) / 2
  return {
    // 比较次数 = 初始一次 + 每次移动后一次；两重循环的次数是组合数 C(n,2)
    caption: `${numbers[left]} + ${numbers[right]} = ${sum}，命中。一共比较 ${picksCount + 1} 次，两重循环要把 ${pairs} 对全试一遍。`,
    hint: '每比较一次就排除一整段 —— 这就是夹逼把 O(n²) 压到 O(n) 的方式。',
  }
}

/**
 * 校验一次「动哪边」的决策。错误的反馈必须讲清「为什么是这个方向」，
 * 而不是笼统的「错了」。
 * @param {Frame} frame
 * @param {string} direction 'left' | 'right'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, direction) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.found) return { ok: false, message: '已经命中了，点「重来」可以再练一次。' }
  if (frame.dead) return { ok: false, message: '区间已经空了，没有这样的两数。点「重来」再来一遍。' }
  if (direction !== 'left' && direction !== 'right') return { ok: false, message: '这不是一个合法方向。' }

  if (direction === correctDirection(frame)) return { ok: true, message: '' }

  if (frame.sum > frame.target) {
    return {
      ok: false,
      message: `现在和是 ${frame.sum}，比目标 ${frame.target} 大 —— 你要的是让和变小。数组是升序的：left 往右移只会让最小值变大，和跟着变大。只有 right 往左收，才能减少最大的那个数。`,
    }
  }
  return {
    ok: false,
    message: `现在和是 ${frame.sum}，比目标 ${frame.target} 小 —— 你要的是让和变大。数组是升序的：right 往左移只会让最大值变小，和跟着变小。只有 left 往右进，才能换掉最小的那个数。`,
  }
}
