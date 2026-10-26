/**
 * 合并两个有序链表（21）的教学引擎。
 *
 * 范式与其它演示一致：纯函数、无 Vue 依赖、非法 pick 静默跳过。
 * 每次决策产 1 帧；一条链走空后的「整段接上」没有决策，自动补 1 帧收尾。
 *
 * 本演示的教学点是「节点被重新串起来」：被选中的节点只改 row / col 两个字段，
 * id 永远不变 —— 渲染层看到的是同一个 <g> 换了位置，绝不能新建一批结果节点。
 * 数据刻意选 [1,3,5] 和 [2,4,6]：两两交错、没有平局，每轮答案唯一。
 */

export const LIST_A = [1, 3, 5]
export const LIST_B = [2, 4, 6]

/** 本轮该取谁：小的先走；相等时固定取 list1 的（值相同先后皆可，规则必须固定）。 */
function correctPick(state) {
  const va = state.nodeById.get(state.l1).value
  const vb = state.nodeById.get(state.l2).value
  return va <= vb ? state.l1 : state.l2
}

/** 拍一帧现场快照，集合类字段现场拷贝，不和引擎内部状态共享引用。 */
function snapshot(state, { caption, hint }) {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    links: state.nodes.map((n) => ({
      from: n.id,
      to: state.nextOf.get(n.id),
      kind: 'normal',
    })),
    pointers: [
      { name: 'l1', at: state.l1 },
      { name: 'l2', at: state.l2 },
      { name: 'tail', at: state.tail },
    ],
    highlights: highlightsOf(state),
    mergedCount: state.mergedCount,
    done: state.done,
    caption,
    hint,
  }
}

/** 下一轮要比较的两个链头给 active；完成后全部转 ok（绿色 = 结果已定）。 */
function highlightsOf(state) {
  const h = {}
  if (state.done) {
    state.nodes.forEach((n) => {
      h[n.id] = 'ok'
    })
    return h
  }
  if (state.l1) h[state.l1] = 'active'
  if (state.l2) h[state.l2] = 'active'
  return h
}

/**
 * 重放出完整帧序列。
 * @param {{listA?: number[], listB?: number[], picks?: string[]}} options
 *        picks 是用户每轮选中的节点 id（'a0' / 'b0' 这种）
 * @returns {Frame[]}
 */
export function buildFrames({ listA = LIST_A, listB = LIST_B, picks = [] } = {}) {
  const state = buildState(listA, listB)

  if (listA.length === 0 && listB.length === 0) {
    state.done = true
    return [
      snapshot(state, {
        caption: '两条链都是空的，合并结果也是空的。',
        hint: '换一组数据再练。',
      }),
    ]
  }

  const frames = [initialFrame(state)]

  // 一条链为空：没有可比较的东西，0 次决策，直接把另一条整段搬下去
  if (state.l1 === null || state.l2 === null) {
    const emptied = state.l1 === null ? 'list1' : 'list2'
    attachRemainder(state)
    frames.push(snapshot(state, doneExtras(state, emptied)))
    return frames
  }

  for (const pick of picks) {
    if (state.done) break // 多余的 pick：已经完成，忽略
    if (state.l1 === null || state.l2 === null) break // 一方已空：等自动收尾，不再消费 pick
    if (pick !== correctPick(state)) continue // 答错的 pick 不产帧，校验是 checkPick 的事

    const emptied = applyMove(frames, state, pick)
    if (emptied) {
      // 这一轮没有决策：一条链刚好走完，剩下的整段接上就收工
      attachRemainder(state)
      frames.push(snapshot(state, doneExtras(state, emptied)))
    }
  }
  return frames
}

function buildState(listA, listB) {
  const nodes = []
  listA.forEach((value, i) => nodes.push({ id: `a${i}`, value, row: 0, col: i }))
  listB.forEach((value, i) => nodes.push({ id: `b${i}`, value, row: 1, col: i }))

  const nextOf = new Map()
  const linkUp = (prefix, len) => {
    for (let i = 0; i < len; i += 1) nextOf.set(`${prefix}${i}`, i + 1 < len ? `${prefix}${i + 1}` : null)
  }
  linkUp('a', listA.length)
  linkUp('b', listB.length)

  return {
    nodes,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    nextOf,
    l1: listA.length > 0 ? 'a0' : null,
    l2: listB.length > 0 ? 'b0' : null,
    tail: null,
    mergedCount: 0,
    done: false,
  }
}

function initialFrame(state) {
  const oneEmpty = state.l1 === null || state.l2 === null
  const base = '两条升序链表。每轮只比较两个链表的当前头，谁小就把谁接到结果链尾部。'
  if (oneEmpty) {
    return snapshot(state, {
      caption: base,
      hint: `${state.l1 === null ? 'list1' : 'list2'} 一开始就是空的 —— 没有可比较的东西，剩下的整段搬下去就行。`,
    })
  }
  const va = state.nodeById.get(state.l1).value
  const vb = state.nodeById.get(state.l2).value
  return snapshot(state, {
    caption: base,
    hint: `${va} 和 ${vb} 比，取谁？想清楚：取大的会让结果链不再升序。`,
  })
}

/**
 * 执行一次答对的选择并产帧。
 * 节点「移动」只改两个字段：row → 2（结果行）、col → 结果链里的序号；
 * next 关系上做两件事：把自己从原链断开（next 置 null），再接到结果链尾。
 * @returns {string|null} 若本次取完恰好把某条链取空，返回那条链的名字
 */
function applyMove(frames, state, pick) {
  const moving = state.nodeById.get(pick)
  const fromList = pick.startsWith('a') ? 'l1' : 'l2'
  const after = state.nextOf.get(pick)

  state.nextOf.set(pick, null) // 断开：它的下一个由结果链说了算，不再指向原链
  if (state.tail) state.nextOf.set(state.tail, pick) // 接到结果链尾
  state.tail = pick
  state[fromList] = after
  moving.row = 2
  moving.col = state.mergedCount
  state.mergedCount += 1

  frames.push(snapshot(state, moveExtras(state, fromList, moving.value, after)))
  return after === null ? (fromList === 'l1' ? 'list1' : 'list2') : null
}

function moveExtras(state, fromList, takenValue, after) {
  const listName = fromList === 'l1' ? 'list1' : 'list2'
  const moved =
    after === null
      ? `${listName} 走完了`
      : `${listName} 的头推到 ${state.nodeById.get(after).value}`

  if (state.l1 === null || state.l2 === null) {
    return {
      caption: `取 ${takenValue} 接到结果后面，${moved}。`,
      hint: '一条链空了就不用再比 —— 剩下的本身就是升序，整段接上。',
    }
  }
  const va = state.nodeById.get(state.l1).value
  const vb = state.nodeById.get(state.l2).value
  return {
    caption: `取 ${takenValue} 接到结果后面，${moved}。下一轮比 ${va} 和 ${vb}。`,
    hint: '只看两个头，谁小谁进结果链 —— 每一轮都只是一次二选一。',
  }
}

/** 一条链已空：把另一条剩下的整段接到结果链尾，全部搬进结果行。 */
function attachRemainder(state) {
  const first = state.l1 ?? state.l2
  // 剩余段内部的 next 本来就是对的，唯一缺的是「结果链尾 → 剩余段头」这一条
  if (state.tail) state.nextOf.set(state.tail, first)
  let cur = first
  while (cur !== null) {
    const node = state.nodeById.get(cur)
    node.row = 2
    node.col = state.mergedCount
    state.mergedCount += 1
    state.tail = cur
    cur = state.nextOf.get(cur)
  }
  state.l1 = null
  state.l2 = null
  state.done = true
}

function doneExtras(state, emptied) {
  return {
    caption: `${emptied} 走完了，剩下的整段接上。${state.nodes.length} 个节点全部搬完，一个都没多也没少 —— 只是 next 指针被重新串了一遍。`,
    hint: '结果链从头到尾升序。点「重来」换一组数据（比如有重复值的）再练。',
  }
}

/**
 * 校验一次「取谁」的点击。错误反馈要讲清「为什么必须取小的」，
 * 而不是笼统的「错了」。
 * @param {Frame} frame
 * @param {string} nodeId 用户点中的节点 id
 * @returns {{ok: boolean, message: string}}
 */
export function checkPick(frame, nodeId) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.done) return { ok: false, message: '已经合并完成，点「重来」再练一次。' }

  const l1 = frame.pointers.find((p) => p.name === 'l1').at
  const l2 = frame.pointers.find((p) => p.name === 'l2').at
  if (l1 === null || l2 === null) {
    return { ok: false, message: '一条链已经走完，剩下的会自动接上 —— 现在不在决策点。' }
  }
  if (!frame.nodes.some((n) => n.id === nodeId)) return { ok: false, message: '这个节点不存在。' }

  const byId = new Map(frame.nodes.map((n) => [n.id, n]))
  const va = byId.get(l1).value
  const vb = byId.get(l2).value

  if (nodeId !== l1 && nodeId !== l2) {
    return {
      ok: false,
      message: `只有两个链表当前的头部才在候选里：现在是 ${va}（list1）和 ${vb}（list2）。你点的这个要么还在队伍中间，要么已经搬进结果链了。`,
    }
  }

  // 相等时约定取 list1 的（va <= vb 含相等），所以点 l1 在平局时也是对的
  if (nodeId === (va <= vb ? l1 : l2)) return { ok: true, message: '' }

  if (va === vb) {
    return {
      ok: false,
      message: `两边头一样大（都是 ${va}）。约定固定取 list1 的 —— 值相同时先后都行，但规则必须固定，不然两边来回跳。`,
    }
  }

  const small = Math.min(va, vb)
  const big = Math.max(va, vb)
  return {
    ok: false,
    message: `现在两边头是 ${va} 和 ${vb}。你取了 ${big} —— 可 ${small} 还没进结果链，先接大的就会把它压在后面，结果不再升序。小的那个必须先走。`,
  }
}
