/**
 * 字母异位词分组（49）的教学引擎 —— 哈希映射版。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、答错的 pick 静默跳过不产帧。
 *
 * 两种决策：① signature（仅第 1 个词）：签名怎么算（必须是排序后的串）；
 * ② lookup（每个词）：签名查得到吗（hit 并入 / miss 建组）。
 *
 * 教学核心：同一个桶 ≠ 同一个 key —— 哈希一样只说明「可能同桶」，
 * key 相等才能确认「同一个」，所以链要挨个比（bat 那一轮是题眼）。
 */

export const DEFAULT_WORDS = ['eat', 'tea', 'tan', 'ate', 'nat', 'bat']
export const DEFAULT_CAPACITY = 6

/** 签名：单词字母按字典序重排 —— 所有异位词算出同一个 key。 */
export function signatureOf(word) {
  return word.split('').sort().join('')
}

/** 字符串键哈希：字符码之和 mod C —— 加法与字母顺序无关，eat 和 aet 同桶。 */
export function hash(s, c) {
  let sum = 0
  for (const ch of s) sum += ch.charCodeAt(0)
  return ((sum % c) + c) % c
}

/** 签名决策的三个选项：原词（没排序）、正确签名、末两位对调的变体（字典序陷阱）。 */
export function signatureChoices(word) {
  const sig = signatureOf(word)
  const chars = sig.split('')
  const swapped = chars.length >= 2 ? chars.slice(0, -2).join('') + chars[chars.length - 1] + chars[chars.length - 2] : sig
  return [...new Set([word, sig, swapped])]
}

/** 拍一帧现场快照，集合类字段现场拷贝。 */
function snapshot(state, extras) {
  return {
    words: state.words,
    capacity: state.capacity,
    cursor: state.cursor,
    signature: extras.signature ?? null,
    buckets: state.buckets.map((chain) => chain.map((n) => ({ ...n }))),
    query: extras.query ?? null,
    groups: state.groups.map((g) => [...g]),
    decision: extras.decision ?? null,
    done: state.done,
    caption: extras.caption,
    hint: extras.hint,
  }
}

/** 当前词的签名在桶里的链位置；找不到返回 -1（miss）。 */
function findKey(state, sig) {
  const b = hash(sig, state.capacity)
  const k = state.buckets[b].findIndex((item) => item.key === sig)
  return { bucket: b, index: k }
}

/**
 * 重放出完整帧序列。
 * @param {{words?: string[], capacity?: number, picks?: string[]}} options
 *        picks：第 1 项是签名决策（'sig-<串>'），其后每词 'hit' | 'miss'
 * @returns {Frame[]}
 */
export function buildFrames({ words = DEFAULT_WORDS, capacity = DEFAULT_CAPACITY, picks = [] } = {}) {
  const state = {
    words,
    capacity,
    buckets: Array.from({ length: capacity }, () => []),
    groups: [],
    cursor: 0,
    done: false,
  }

  if (words.length === 0) {
    state.done = true
    return [snapshot(state, { caption: '没有单词，分成 0 组。', hint: '换一组数据再练。' })]
  }

  const first = words[0]
  const correctSig = signatureOf(first)
  const frames = [
    snapshot(state, {
      decision: 'signature',
      caption: `${words.length} 个单词，把「字母相同、顺序不同」的分成一组。第 1 个词是 ${first} —— 它的签名（分组的 key）是什么？`,
      hint: '签名必须让所有异位词算出同一个 key：把字母按字典序重排。',
    }),
  ]

  let sigDecided = false
  for (const pick of picks) {
    if (state.done) break
    if (!sigDecided) {
      if (pick !== `sig-${correctSig}`) continue // 签名选错的 pick 静默跳过
      sigDecided = true
      pushLookupAsk(frames, state, correctSig)
      continue
    }
    const word = state.words[state.cursor]
    const sig = signatureOf(word)
    const truth = findKey(state, sig).index >= 0 ? 'hit' : 'miss'
    if (pick !== truth) continue
    playLookup(frames, state, sig, truth)
  }
  return frames
}

/** 签名决策答对后的提问帧：亮出算式，问「查得到吗」。 */
function pushLookupAsk(frames, state, sig) {
  const word = state.words[state.cursor]
  const sum = charSum(sig)
  const b = hash(sig, state.capacity)
  frames.push(
    snapshot(state, {
      signature: sig,
      decision: 'lookup',
      caption: `${word} 的签名是 ${sig}（字母排序）。hash('${sig}') = 字符码和 ${sum}，${sum} mod ${state.capacity} = ${b}。${sig} 查得到吗？`,
      hint: '先看桶，再看链：桶里可能住着别的 key。',
    }),
  )
}

function charSum(s) {
  let sum = 0
  for (const ch of s) sum += ch.charCodeAt(0)
  return sum
}

/** 打完一轮查签名：定位帧 → 逐节点比对帧 → 并入帧（hit）/ 建组帧（miss）。 */
function playLookup(frames, state, sig, truth) {
  const word = state.words[state.cursor]
  const C = state.capacity
  const b = hash(sig, C)
  const chain = state.buckets[b]
  const hitIndex = chain.findIndex((item) => item.key === sig)

  frames.push(
    snapshot(state, {
      signature: sig,
      query: { bucket: b, key: sig, checked: 0, phase: 'scan' },
      caption: `hash('${sig}') = ${charSum(sig)} mod ${C} = ${b}，定位到桶 ${b}。`,
      hint: '桶只是「小区」，key 才是「门牌」—— 还得挨个比。',
    }),
  )

  for (let k = 0; k < chain.length; k += 1) {
    const isHit = k === hitIndex
    frames.push(
      snapshot(state, {
        signature: sig,
        query: { bucket: b, key: sig, checked: k, phase: isHit ? 'hit' : 'scan' },
        caption: isHit
          ? `比对：链上第 ${k} 个就是 ${sig} —— 同一个 key！`
          : `比对：链上第 ${k} 个是 ${chain[k].key}，不是 ${sig}（同一个桶 ≠ 同一个 key），往下一个。`,
        hint: isHit ? 'key 相等，才能确认是同一组。' : '哈希一样只说明可能同桶，还得比 key。',
      }),
    )
  }

  if (truth === 'hit') {
    const node = state.buckets[b][hitIndex]
    const group = state.groups.find((g) => signatureOf(g[0]) === sig)
    group.push(word)
    const count = group.length
    node.value = `${count} 个`
    frames.push(
      snapshot(state, {
        signature: sig,
        query: { bucket: b, key: sig, checked: hitIndex, phase: 'hit' },
        caption: `${sig} 已有分组：${word} 并入，这组现在 ${count} 个（链节点计数 → "${count} 个"）。`,
        hint: '并入不动链结构，只把计数 +1 —— 这就是 Map 版哈希表的 value。',
      }),
    )
  } else {
    // 先记下桶里原本有没有人：push 之后再判断会把空桶误判成冲突
    const hadBefore = chain.length > 0
    state.buckets[b].push({ id: `g${state.cursor}`, key: sig, value: '1 个' })
    state.groups.push([word])
    frames.push(
      snapshot(state, {
        signature: sig,
        caption: hadBefore
          ? `桶 ${b} 里已经有 ${chain[0].key} 了 —— 但同一个桶不等于同一个 key：链要挨个比，${chain[0].key} ≠ ${sig}，所以 ${sig} 自己成一组，挂在 ${chain[0].key} 下面。`
          : `桶 ${b} 是空的：${sig} 建新组，入链，计数「1 个」。`,
        hint: 'hash(eat) 和 hash(aet) 一样 —— 字符码加法跟顺序无关。但 key 不一样：哈希同桶只是候选，key 相等才确认。',
      }),
    )
  }

  state.cursor += 1
  if (state.cursor === state.words.length) {
    state.done = true
    frames.push(
      snapshot(state, {
        signature: sig,
        caption: `全部 ${state.words.length} 个词分完，共 ${state.groups.length} 组。同桶不同 key 的（ant / abt）靠链上挨个比区分开 —— 这就是「桶 + 链」两层的分工。`,
        hint: '点「重来」再走一遍，盯住 bat 那一轮。',
      }),
    )
    return
  }
  pushLookupAsk(frames, state, signatureOf(state.words[state.cursor]))
}

/**
 * 校验一次决策。
 * @param {Frame} frame
 * @param {string} action 'sig-<串>' | 'hit' | 'miss'
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, action) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经分完了，点「重来」再练一次。' }

  if (frame.decision === 'signature') {
    const word = frame.words[frame.cursor]
    const correct = signatureOf(word)
    if (action === `sig-${correct}`) return { ok: true, message: '' }
    if (!action.startsWith('sig-')) return { ok: false, message: '这不是一个合法动作。' }
    const picked = action.slice(4)
    if (picked === word) {
      return {
        ok: false,
        message: `这是原词，没排序 —— tea 和 ate 排完序都是 '${correct}'，签名必须让所有异位词算出同一个 key，所以要重排。`,
      }
    }
    return {
      ok: false,
      message: `'${picked}' 和 '${word}' 是同一组字母，但不是字典序（a < e < t）—— 签名必须所有人算出来都一样，所以取排序后的 '${correct}'。`,
    }
  }

  if (frame.decision === 'lookup') {
    if (action !== 'hit' && action !== 'miss') return { ok: false, message: '这不是一个合法动作。' }
    const sig = frame.signature
    const chain = frame.buckets[hash(sig, frame.capacity)]
    const hit = chain.find((item) => item.key === sig)
    if (hit) {
      if (action === 'hit') return { ok: true, message: '' }
      return {
        ok: false,
        message: `在的：桶 ${hash(sig, frame.capacity)} 的链里就有 key '${sig}'（${hit.value}）—— 同一个签名就是同一组，查得到。`,
      }
    }
    if (action === 'miss') return { ok: true, message: '' }
    return {
      ok: false,
      message: `不在：桶 ${hash(sig, frame.capacity)} 的链里只有 ${chain.map((n) => n.key).join('、') || '（空）'}，没有 key '${sig}' —— 同桶不是同 key，得建新组。`,
    }
  }

  return { ok: false, message: '现在不在决策点。' }
}
