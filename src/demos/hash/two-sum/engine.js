/**
 * 两数之和（1）的教学引擎 —— 哈希表版。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、答错的 pick 静默跳过不产帧。
 *
 * 两种决策：
 * ① order（仅第 0 轮）：先查后存还是先存后查 —— 先存后查会查到自己（[0,0] 陷阱）；
 * ② lookup（每轮）：补数 c 查得到吗（hit / miss）。
 * 一次查补数逐帧产出：定位桶 →（链上每节点一张比对帧）→ 结果帧；miss 再追加一张存入帧。
 *
 * 教学核心：先查后存 + 哈希把「找一个数」压成 O(1)，整体 O(n)。
 */

export const GROUP_A = { nums: [3, 2, 4], target: 6, capacity: 8 }
export const GROUP_B = { nums: [1, 5, 3, 6], target: 9, capacity: 4 }

/** 数字键哈希：负数安全（JS 的 % 对负数给负余数，先 +C 再 % 拉回正区间）。 */
export function hash(k, c) {
  return ((k % c) + c) % c
}

/** 拍一帧现场快照。buckets 深拷贝，不和引擎内部状态共享引用。 */
function snapshot(state, extras) {
  return {
    nums: state.nums,
    target: state.target,
    capacity: state.capacity,
    cursor: state.cursor,
    complement: extras.complement ?? null,
    buckets: state.buckets.map((chain) => chain.map((n) => ({ ...n }))),
    query: extras.query ?? null,
    decision: extras.decision ?? null,
    answer: state.answer,
    done: state.done,
    caption: extras.caption,
    hint: extras.hint,
  }
}

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], target?: number, capacity?: number, picks?: string[]}} options
 *        picks：第 1 项是 order 决策（'lookup-first'），其后每轮 'hit' | 'miss'
 * @returns {Frame[]}
 */
export function buildFrames({
  nums = GROUP_A.nums,
  target = GROUP_A.target,
  capacity = GROUP_A.capacity,
  picks = [],
} = {}) {
  const state = {
    nums,
    target,
    capacity,
    buckets: Array.from({ length: capacity }, () => []),
    map: new Map(), // key(数值) → 下标，先查后存的「查」就是对它
    cursor: 0,
    answer: null,
    done: false,
  }

  if (nums.length === 0) {
    state.done = true
    return [
      snapshot(state, {
        caption: '数组是空的，凑不出两个数。',
        hint: '换一组数据再练。',
      }),
    ]
  }

  const c0 = target - nums[0]
  const frames = [
    snapshot(state, {
      decision: 'order',
      caption: `要在数组里找两个数，和等于 ${target}。每一轮拿到一个数 x，先去表里查它的补数 ${target} − x，查到就出答案，查不到再把 x 存进去。`,
      hint: `第一个数是 ${nums[0]}，它的补数 c = ${target} − ${nums[0]} = ${c0}。先想清楚：为什么必须「先查后存」？`,
    }),
  ]

  let started = false
  for (const pick of picks) {
    if (state.done) break
    if (!started) {
      // 决策①：只认「先查后存」；选错的 pick 静默跳过（校验是 checkPick 的事）
      if (pick !== 'lookup-first') continue
      started = true
      frames.push(
        snapshot(state, {
          decision: 'lookup',
          complement: c0,
          caption: `好，先查后存。第 0 个数是 ${nums[0]}，补数 c = ${target} − ${nums[0]} = ${c0}。c 查得到吗？`,
          hint: '现在表还是空的 —— 但每一步都该先查，规则不能看情况变通。',
        }),
      )
      continue
    }
    const i = state.cursor
    const c = target - nums[i]
    const truth = state.map.has(c) ? 'hit' : 'miss'
    if (pick !== truth) continue
    playLookup(frames, state, c, truth)
  }
  return frames
}

/** 打完一轮「查补数」：定位帧 → 逐节点比对帧 → 结果帧；miss 再追加存入帧。 */
function playLookup(frames, state, c, truth) {
  const i = state.cursor
  const C = state.capacity
  const b = hash(c, C)
  const chain = state.buckets[b]
  const key = String(c)

  frames.push(
    snapshot(state, {
      query: { bucket: b, key, checked: 0, phase: 'scan' },
      caption: `查补数 ${c}：hash(${c}) = ${c} mod ${C} = ${b}，定位到桶 ${b}。`,
      hint: '哈希不找「值在哪」，只算「值该在哪个桶」—— 一步到位。',
    }),
  )

  let hitIndex = -1
  chain.forEach((item, k) => {
    if (item.key === key) hitIndex = k
  })

  for (let k = 0; k < chain.length; k += 1) {
    const isHit = k === hitIndex
    frames.push(
      snapshot(state, {
        query: { bucket: b, key, checked: k, phase: isHit ? 'hit' : 'scan' },
        caption: isHit
          ? `比对：链上第 ${k} 个就是 ${c} —— 命中！`
          : `比对：链上第 ${k} 个是 ${chain[k].key}，不是 ${c}，往下一个。`,
        hint: isHit ? '它就是等着和当前数配对的那个。' : '同一条链上的 key 各不相同，挨个比。',
      }),
    )
  }

  if (truth === 'hit') {
    const j = state.map.get(c)
    state.answer = [j, i]
    state.done = true
    frames.push(
      snapshot(state, {
        query: { bucket: b, key, checked: hitIndex, phase: 'hit' },
        caption: `命中：${c} 存于下标 ${j}，和当前的 ${state.nums[i]}（下标 ${i}）配对 —— 答案 [${j}, ${i}]。`,
        hint: `哈希表用一次 O(n) 的存，换来了每一轮 O(1) 的查 —— 整体 O(n)，比两层循环少一个数量级。`,
      }),
    )
    return
  }

  frames.push(
    snapshot(state, {
      query: { bucket: b, key, checked: chain.length, phase: 'miss' },
      caption: chain.length === 0 ? `桶 ${b} 是空的 —— miss，表里没有 ${c}。` : `整条链比完都没有 ${c} —— miss。`,
      hint: '查不到就把当前数存进去，让它去等后面的补数。',
    }),
  )

  storeCurrent(frames, state)
}

/** 把当前数存入表：桶里已有别的 key 就是冲突帧（链的意义在此）。 */
function storeCurrent(frames, state) {
  const i = state.cursor
  const v = state.nums[i]
  const C = state.capacity
  const b = hash(v, C)
  const chain = state.buckets[b]

  chain.push({ id: `k${i}`, key: String(v), value: `#${i}` })
  state.map.set(v, i)
  state.cursor += 1

  if (chain.length > 1) {
    frames.push(
      snapshot(state, {
        caption: `hash(${v}) = ${v} mod ${C} = ${b}，桶 ${b} 已经有 ${chain[0].key} 了 —— 两个 key 挤一个桶，就是「冲突」。链就是为它存在的：${v} 挂在 ${chain[0].key} 下面，查的时候从上往下挨个比。`,
        hint: '冲突不删谁、也不覆盖谁：挂成链，查询时多比几步。',
      }),
    )
  } else {
    frames.push(
      snapshot(state, {
        caption: `存 key=${v}、value=#${i} —— 以后查 ${v} 一步就到桶 ${b}。`,
        hint: '存的是「值 → 下标」：查到 key 就等于查到下标。',
      }),
    )
  }

  if (state.cursor === state.nums.length) {
    state.done = true
    frames.push(
      snapshot(state, {
        caption: `扫完了：整个数组都过完，没有两个数的和等于 ${state.target}。`,
        hint: '先查后存保证了每个数只和「它前面的数」配对，不会漏也不会自己配自己。',
      }),
    )
    return
  }

  const next = state.nums[state.cursor]
  const nextC = state.target - next
  frames.push(
    snapshot(state, {
      decision: 'lookup',
      complement: nextC,
      caption: `第 ${state.cursor} 个数是 ${next}，补数 c = ${state.target} − ${next} = ${nextC}。c 查得到吗？`,
      hint: '想清楚 c 会落在哪个桶、那个桶里现在有什么。',
    }),
  )
}

/**
 * 校验一次决策。
 * @param {Frame} frame
 * @param {string} action 'lookup-first' | 'store-first' | 'hit' | 'miss'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经结束了，点「重来」再练一次。' }

  if (frame.decision === 'order') {
    if (action !== 'lookup-first' && action !== 'store-first') {
      return { ok: false, message: '这不是一个合法动作。' }
    }
    if (action === 'lookup-first') return { ok: true, message: '' }
    const trap = frame.target - frame.nums[0] === frame.nums[0]
    if (trap) {
      return {
        ok: false,
        message: `顺序反了。第一个数是 ${frame.nums[0]}，它的补数恰好也是 ${frame.nums[0]} —— 先存再查，查到的其实是刚存进去的自己，返回 [0,0]：一个数和自己配对，题目不允许。必须先查后存。`,
      }
    }
    return {
      ok: false,
      message: '顺序反了。先存再查，遇到「补数恰好等于自己」的数据（比如 [3,3] 找 6）就会查到自己、返回 [0,0] —— 一个数和自己配对，题目不允许。必须先查后存。',
    }
  }

  if (frame.decision === 'lookup') {
    if (action !== 'hit' && action !== 'miss') return { ok: false, message: '这不是一个合法动作。' }
    const c = frame.complement
    const b = hash(c, frame.capacity)
    const chain = frame.buckets[b]
    const found = chain.some((n) => n.key === String(c))
    if (found) {
      if (action === 'hit') return { ok: true, message: '' }
      const hit = chain.find((n) => n.key === String(c))
      return {
        ok: false,
        message: `在的：桶 ${b} 的链里就有 ${c}（value ${hit.value}）—— 它早就存进去了，查得到，答案是现成的。`,
      }
    }
    if (action === 'miss') return { ok: true, message: '' }
    return {
      ok: false,
      message: `不在：hash(${c}) = ${c} mod ${frame.capacity} = ${b}，桶 ${b} ${
        chain.length === 0 ? '是空的' : `的链里只有 ${chain.map((n) => n.key).join('、')}`
      }，没有 ${c}。`,
    }
  }

  return { ok: false, message: '现在不在决策点。' }
}
