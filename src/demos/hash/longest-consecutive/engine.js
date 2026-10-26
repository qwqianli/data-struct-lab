/**
 * 最长连续序列（128）的教学引擎 —— 哈希集合版。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、答错的 pick 静默跳过不产帧。
 *
 * 两个阶段：① 自动建表（每个数一帧，Set 语义：重复的不再存）；② 逐个判定起点
 * （决策 start：n−1 在表里吗）→ 是起点再数段（决策 count：能数多长）。
 *
 * 教学核心：n−1 不在表里，n 才配当起点 —— 否则每个数都往上数，退回 O(n²)；
 * 判起点那一下把 O(n²) 砍成 O(n)：每个数只被「往上数」经过一次。
 */

export const DEFAULT_NUMS = [100, 4, 200, 1, 3, 2]
export const DEFAULT_CAPACITY = 8

/** 数字键哈希：负数安全（与 two-sum 引擎同一口径）。 */
export function hash(k, c) {
  return ((k % c) + c) % c
}

/** 拍一帧现场快照，集合类字段现场拷贝。 */
function snapshot(state, extras) {
  return {
    nums: state.nums,
    capacity: state.capacity,
    buckets: state.buckets.map((chain) => chain.map((n) => ({ ...n }))),
    query: extras.query ?? null,
    stage: state.stage,
    scanIndex: state.scanIndex,
    run: extras.run ?? 0,
    best: state.best,
    bestRange: state.bestRange === null ? null : [...state.bestRange],
    decision: extras.decision ?? null,
    done: state.done,
    caption: extras.caption,
    hint: extras.hint,
  }
}

/** 从 n 往上数连续段长：表里有 n+1 就 +1，断为止。 */
function runLength(set, n) {
  let len = 1
  while (set.has(n + len)) len += 1
  return len
}

/** 在桶里找到 key 的链位置（点亮用）。 */
function locate(state, key) {
  const b = hash(key, state.capacity)
  const k = state.buckets[b].findIndex((item) => item.key === String(key))
  return { bucket: b, checked: Math.max(k, 0) }
}

/**
 * 重放出完整帧序列。
 * @param {{nums?: number[], capacity?: number, picks?: string[]}} options
 *        picks：阶段二的决策序列，start 轮是 'yes' | 'no'，count 轮是 'count-1'..'count-4'
 * @returns {Frame[]}
 */
export function buildFrames({ nums = DEFAULT_NUMS, capacity = DEFAULT_CAPACITY, picks = [] } = {}) {
  const state = {
    nums,
    capacity,
    buckets: Array.from({ length: capacity }, () => []),
    set: new Set(),
    stage: 'build', // build（自动建表）→ scan（判定与数段）→ done
    scanIndex: 0,
    best: 0,
    bestRange: null,
    done: false,
  }

  if (nums.length === 0) {
    state.stage = 'done'
    state.done = true
    return [snapshot(state, { caption: '数组是空的，最长连续序列长度 0。', hint: '换一组数据再练。' })]
  }

  const frames = [
    snapshot(state, {
      caption: `数组 [${nums.join(', ')}]。第一步先把所有数建进哈希集合 —— 一遍建表一遍扫会漏，先建完再扫。`,
      hint: '表建好后，每个数都能 O(1) 查到「在不在」。',
    }),
  ]

  // 阶段一：自动建表，每个数一帧（Set 语义：重复的不再存）
  for (const n of nums) {
    insertOne(frames, state, n)
  }
  state.stage = 'scan'
  pushScanAsk(frames, state)

  let awaiting = 'start'
  for (const pick of picks) {
    if (state.done) break
    const n = state.nums[state.scanIndex]

    if (awaiting === 'start') {
      const prevIn = state.set.has(n - 1)
      if (pick !== (prevIn ? 'yes' : 'no')) continue
      if (prevIn) {
        advanceScan(frames, state, {
          caption: `${n - 1} 在表里 —— 从 ${n} 出发能数到的段，从 ${n - 1} 出发只会更长，所以 ${n} 不配当起点，跳过。`,
          hint: '只从「段的最左端」出发往上数，才不会重复劳动。',
        })
        continue
      }
      // n−1 不在：n 是起点，转入数段决策
      frames.push(
        snapshot(state, {
          decision: 'count',
          caption: `${n - 1} 不在表里 —— ${n} 是一个段的起点。从 ${n} 往上连续数，能数出多长的段？`,
          hint: '一个一个看：n+1 在表里吗？n+2 呢？数到断为止。',
        }),
      )
      awaiting = 'count'
      continue
    }

    // awaiting === 'count'
    const len = runLength(state.set, n)
    if (pick !== `count-${len}`) continue
    playCount(frames, state, n, len)
    awaiting = 'start'
  }
  return frames
}

/** 建表帧：桶里已有别的 key 时 caption 讲冲突；Set 语义重复值不再存。 */
function insertOne(frames, state, n) {
  const b = hash(n, state.capacity)
  const chain = state.buckets[b]

  if (state.set.has(n)) {
    frames.push(
      snapshot(state, {
        caption: `${n} 已经在表里了 —— Set 不会存两份，跳过。`,
        hint: '集合只回答「在不在」，不需要重复的成员。',
      }),
    )
    return
  }

  chain.push({ id: `k${n}`, key: String(n), value: '' })
  state.set.add(n)
  if (chain.length > 1) {
    frames.push(
      snapshot(state, {
        caption: `hash(${n}) = ${n} mod ${state.capacity} = ${b}，桶 ${b} 已经有 ${chain[0].key} —— ${n} 挂在它下面成链。冲突不碍事：查的时候挨个比 key。`,
        hint: '同一个桶可以住很多 key，链越短查得越快。',
      }),
    )
    return
  }
  frames.push(
    snapshot(state, {
      caption: `存 ${n}：hash(${n}) = ${n} mod ${state.capacity} = ${b}，落桶 ${b}。`,
      hint: '集合只存 key、不存 value —— 我们只关心「在不在」。',
    }),
  )
}

/** scan 阶段的提问帧：n−1 在表里吗。 */
function pushScanAsk(frames, state) {
  const n = state.nums[state.scanIndex]
  frames.push(
    snapshot(state, {
      decision: 'start',
      caption: `看 ${n}：${n - 1} 在表里吗？在，${n} 就不是段起点；不在，它才是。`,
      hint: '判起点是这道题全部的效率来源 —— 想想为什么。',
    }),
  )
}

/** 推进到下一个数；走到头就收尾（最后一帧就地置 done 并给出 verdict）。 */
function advanceScan(frames, state, extras) {
  state.scanIndex += 1
  if (state.scanIndex === state.nums.length) {
    state.stage = 'done'
    state.done = true
    const [start, len] = state.bestRange
    frames.push(
      snapshot(state, {
        ...extras,
        caption: `${extras.caption} 全部看完：最长连续序列长度 ${state.best}（${Array.from({ length: len }, (_, i) => start + i).join(',')}）。判起点那一下，把 O(n²) 砍成了 O(n)：每个数只被「往上数」经过一次，因为它只在唯一的段起点出发时被数。`,
        hint: '点「重来」再走一遍，注意哪些数只是被跳过、从未被数。',
      }),
    )
    return
  }
  const next = state.nums[state.scanIndex]
  frames.push(
    snapshot(state, {
      ...extras,
      decision: 'start',
      caption: `${extras.caption} 下一个看 ${next}：${next - 1} 在表里吗？`,
      hint: '还是那一条：n−1 在，n 就不用出发。',
    }),
  )
}

/** 数段：每往上数到的一个数产一帧（亮对应节点），最后结算帧更新 best。 */
function playCount(frames, state, n, len) {
  for (let m = n + 1; m < n + len; m += 1) {
    const spot = locate(state, m)
    frames.push(
      snapshot(state, {
        query: { bucket: spot.bucket, key: String(m), checked: spot.checked, phase: 'hit' },
        run: m - n + 1,
        caption: `${m} 在表里（桶 ${spot.bucket}）—— 段继续往上，已经数到 ${m - n + 1} 个。`,
        hint: '每数一个都是一次 O(1) 的查询。',
      }),
    )
  }

  const prevBest = state.best
  if (len > state.best) {
    state.best = len
    state.bestRange = [n, len]
  }
  advanceScan(frames, state, {
    caption: `段 [${n}..${n + len - 1}] 长 ${len}，best ${len > prevBest ? `${prevBest} → ${len}` : `保持 ${state.best}`}。`,
    hint: '只有起点的段才被完整数过 —— 非起点的段早就被更长的段覆盖了。',
  })
}

/**
 * 校验一次决策。
 * @param {Frame} frame
 * @param {string} action 'yes' | 'no' | 'count-1'..'count-4'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经看完了，点「重来」再练一次。' }

  if (frame.decision === 'start') {
    if (action !== 'yes' && action !== 'no') return { ok: false, message: '这不是一个合法动作。' }
    const n = frame.nums[frame.scanIndex]
    const prev = n - 1
    const prevIn = frame.buckets[hash(prev, frame.capacity)].some((item) => item.key === String(prev))
    if (prevIn) {
      if (action === 'yes') return { ok: true, message: '' }
      return {
        ok: false,
        message: `在的：${prev} 就存在桶 ${hash(prev, frame.capacity)} 的链里 —— n−1 在表里，从 ${prev} 出发能数到的段只会更长，${n} 不配当起点。`,
      }
    }
    if (action === 'no') return { ok: true, message: '' }
    return {
      ok: false,
      message: `不在：hash(${prev}) = ${prev} mod ${frame.capacity} = ${hash(prev, frame.capacity)}，桶里没有 ${prev} —— ${n} 前面断开了，它才是起点。`,
    }
  }

  if (frame.decision === 'count') {
    if (!/^count-[1-4]$/.test(action)) return { ok: false, message: '这不是一个合法动作。' }
    const n = frame.nums[frame.scanIndex]
    const len = runLength(new Set(frame.buckets.flat().map((item) => Number(item.key))), n)
    if (action === `count-${len}`) return { ok: true, message: '' }
    // 数段答错不直接报答案：把「怎么数」的方法还给学习者
    return {
      ok: false,
      message: `先别猜长度：从 ${n + 1} 开始，一个一个看它在不在表里（n+1 在就数 2，再看 n+2……），数到第一个不在的为止。`,
    }
  }

  return { ok: false, message: '现在不在决策点。' }
}
