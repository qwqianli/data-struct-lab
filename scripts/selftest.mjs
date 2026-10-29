/**
 * 引擎自检 —— 零依赖，直接 `node scripts/selftest.mjs`。
 *
 * 为什么不装 vitest：现在只有 1 个引擎、断言不到 20 条，
 * 装一套测试框架换来的是 20 多个包和一份配置。等到引擎数量上到 5 个以上、
 * 需要 watch 模式和覆盖率时再换 vitest 不迟。先保证「每条帧都能断言」这件事成立。
 *
 * 校验的是三件最容易错的事：
 * ① 帧序列（每轮区间是否正确收缩）
 * ② checkPick 的反馈文案有没有走错分支
 * ③ 已找到 / 区间清空之后还能不能继续推进
 */
import assert from 'node:assert/strict'
import { buildFrames, checkPick, expectedMid, DEFAULT_VALUES, DEFAULT_TARGET } from '../src/demos/array/binary-search/engine.js'

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  FAIL ${name}\n       ${err.message}`)
  }
}

console.log('\n[1] expectedMid')
check('(0+9)/2 = 4，取下中点', () => assert.equal(expectedMid(0, 9), 4))
check('(5+6)/2 = 5', () => assert.equal(expectedMid(5, 6), 5))
check('区间只有一个元素时 mid 就是它自己', () => assert.equal(expectedMid(3, 3), 3))

console.log('\n[2] 初始帧')
const f0 = buildFrames()[0]
check('初始区间覆盖整个数组', () => {
  assert.equal(f0.low, 0)
  assert.equal(f0.high, DEFAULT_VALUES.length - 1)
})
check('初始没有 mid、没有排除项、没有比较', () => {
  assert.equal(f0.mid, null)
  assert.deepEqual(f0.eliminated, [])
  assert.equal(f0.compares, 0)
})
check('默认数据里确实有这个目标值', () => assert.ok(DEFAULT_VALUES.includes(DEFAULT_TARGET)))

console.log('\n[3] 一次完整命中（4 → 7 → 5）')
const frames = buildFrames({ picks: [4, 7, 5] })
check('帧数 = 1 初始 + 3 次点击', () => assert.equal(frames.length, 4))
check('第 1 轮：mid=4，值 16 < 23，左半含 mid 全部排除，low 推到 5', () => {
  const f = frames[1]
  assert.equal(f.mid, 4)
  assert.equal(f.low, 5)
  assert.equal(f.high, 9)
  assert.deepEqual(f.eliminated, [0, 1, 2, 3, 4])
})
check('第 2 轮：mid=7，值 56 > 23，右半排除，high 收到 6', () => {
  const f = frames[2]
  assert.equal(f.mid, 7)
  assert.equal(f.low, 5)
  assert.equal(f.high, 6)
  assert.deepEqual(f.eliminated, [0, 1, 2, 3, 4, 7, 8, 9])
})
check('第 3 轮命中，compares=3', () => {
  const f = frames[3]
  assert.equal(f.found, true)
  assert.equal(f.mid, 5)
  assert.equal(f.compares, 3)
})

console.log('\n[4] checkPick 的分支')
check('点对中点 → ok', () => assert.equal(checkPick(f0, 4).ok, true))
check('点上中点 → 提示口径统一，不是笼统的「错了」', () => {
  const r = checkPick(f0, 5)
  assert.equal(r.ok, false)
  assert.match(r.message, /上中点/)
})
check('点区间外的下标 → 提示已被排除', () => {
  const f = frames[2] // 区间 [5,6]
  const r = checkPick(f, 9)
  assert.equal(r.ok, false)
  assert.match(r.message, /不在当前区间/)
})
check('算错中点 → 文案里带上正确算式和两个值', () => {
  const r = checkPick(f0, 2)
  assert.equal(r.ok, false)
  assert.match(r.message, /\(0 \+ 9\) \/\/ 2 = 4/)
  assert.match(r.message, /16/)
})
check('已命中后再点 → 不再推进', () => {
  const r = checkPick(frames[3], 5)
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})

console.log('\n[5] 目标不存在时区间能被清空')
const miss = buildFrames({ target: 100, picks: [4, 7, 8, 9] })
check('最终 dead=true', () => assert.equal(miss[miss.length - 1].dead, true))
check('区间为空（low > high）', () => {
  const last = miss[miss.length - 1]
  assert.ok(last.low > last.high)
})
check('dead 之后不再产出新帧', () => {
  const more = buildFrames({ target: 100, picks: [4, 7, 8, 9, 5, 6] })
  assert.equal(more.length, miss.length)
})

console.log('\n[6] 非法 picks 不污染帧序列')
check('乱序的下标被忽略，不会产生错帧', () => {
  const clean = buildFrames({ picks: [4, 7, 5] })
  const dirty = buildFrames({ picks: [4, 2, 7, 0, 5] })
  assert.equal(dirty.length, clean.length)
  assert.equal(dirty[dirty.length - 1].found, true)
})

// ============================================================
// 演示：反转链表（206）。
// 用动态 import 是为了让新增部分完全自包含 —— 静态 import 必须写在文件顶部。
// 汇总与 exit 只在文件最末尾打一次，保证所有分组都跑完才出结论。
// ============================================================
const rl = await import('../src/demos/linked-list/reverse-list/engine.js')
const rlSave = () => Array.from({ length: 5 }, () => rl.ACTIONS.SAVE_NEXT)

console.log('\n[7] 206 反转链表 · 初始帧')
check('初始帧：prev 悬空、cur 指向 n0、ask 非空', () => {
  const f0 = rl.buildFrames()[0]
  assert.equal(f0.pointers.find((p) => p.name === 'prev').at, null)
  assert.equal(f0.pointers.find((p) => p.name === 'cur').at, 'n0')
  assert.ok(f0.ask !== null)
})
check('初始帧：5 条边（含末尾指向 ∅ 的那条）全部 normal', () => {
  const f0 = rl.buildFrames()[0]
  assert.equal(f0.links.length, 5)
  assert.ok(f0.links.every((l) => l.kind === 'normal'))
})

console.log('\n[8] 206 · 一轮与全程')
check('答对 1 轮：共 4 帧，恰好 1 条 reversed 边，是 n0 → ∅', () => {
  const one = rl.buildFrames({ picks: [rl.ACTIONS.SAVE_NEXT] })
  assert.equal(one.length, 4) // 1 初始 + 3 帧
  const reversed = one[one.length - 1].links.filter((l) => l.kind === 'reversed')
  assert.equal(reversed.length, 1)
  assert.equal(reversed[0].from, 'n0')
  assert.equal(reversed[0].to, null)
})
check('答对 1 轮后：选项顺序按轮数轮转，正确答案不再固定在第一位', () => {
  const one = rl.buildFrames({ picks: [rl.ACTIONS.SAVE_NEXT] })
  assert.equal(one[one.length - 1].ask.options[0].action, rl.ACTIONS.RELINK)
})
check('答对 5 轮：done，5 条边全 reversed，指针只剩 prev 指向 n4', () => {
  const full = rl.buildFrames({ picks: rlSave() })
  assert.equal(full.length, 16) // 1 初始 + 5×3 帧
  const last = full[full.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.ask, null)
  assert.equal(last.links.length, 5)
  assert.ok(last.links.every((l) => l.kind === 'reversed'))
  assert.deepEqual(last.pointers, [{ name: 'prev', at: 'n4' }])
})
check('全程 nodes 的顺序与 id 从未改变（反转只改 links，不重排节点）', () => {
  const full = rl.buildFrames({ picks: rlSave() })
  full.forEach((f) => {
    assert.deepEqual(f.nodes.map((n) => n.id), ['n0', 'n1', 'n2', 'n3', 'n4'])
    assert.deepEqual(f.nodes.map((n) => n.value), [1, 2, 3, 4, 5])
  })
})

console.log('\n[9] 206 · checkPick 的分支')
check('选 RELINK → 致命反馈，点名会丢的链', () => {
  const r = rl.checkPick(rl.buildFrames()[0], rl.ACTIONS.RELINK)
  assert.equal(r.ok, false)
  assert.match(r.message, /丢|断/)
})
check('选 ADVANCE → 顺序反馈', () => {
  const r = rl.checkPick(rl.buildFrames()[0], rl.ACTIONS.ADVANCE)
  assert.equal(r.ok, false)
  assert.match(r.message, /顺序/)
})
check('选 SAVE_NEXT → ok，message 为空串', () => {
  const r = rl.checkPick(rl.buildFrames()[0], rl.ACTIONS.SAVE_NEXT)
  assert.equal(r.ok, true)
  assert.equal(r.message, '')
})
check('done 之后再选 → 提示「重来」', () => {
  const full = rl.buildFrames({ picks: rlSave() })
  const r = rl.checkPick(full[full.length - 1], rl.ACTIONS.SAVE_NEXT)
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})
check('非法动作名 → 不是合法操作', () => {
  const r = rl.checkPick(rl.buildFrames()[0], 'jump')
  assert.equal(r.ok, false)
  assert.match(r.message, /合法/)
})
check('不在决策帧（自动帧 ask 为 null）→ 现在不在决策点', () => {
  const one = rl.buildFrames({ picks: [rl.ACTIONS.SAVE_NEXT] })
  assert.equal(one[1].ask, null)
  const r = rl.checkPick(one[1], rl.ACTIONS.SAVE_NEXT)
  assert.equal(r.ok, false)
  assert.match(r.message, /不在决策点/)
})

console.log('\n[10] 206 · 边界情况')
check('非法 / 答错的 pick 被静默跳过，帧数与纯正确序列一致', () => {
  const clean = rl.buildFrames({ picks: [rl.ACTIONS.SAVE_NEXT, rl.ACTIONS.SAVE_NEXT, rl.ACTIONS.SAVE_NEXT] })
  const dirty = rl.buildFrames({
    picks: ['relink', rl.ACTIONS.SAVE_NEXT, 'advance', rl.ACTIONS.SAVE_NEXT, 'boom', rl.ACTIONS.SAVE_NEXT],
  })
  assert.equal(dirty.length, clean.length)
})
check('values 为空数组 → 1 帧且 done，不抛异常', () => {
  const empty = rl.buildFrames({ values: [] })
  assert.equal(empty.length, 1)
  assert.equal(empty[0].done, true)
  assert.match(empty[0].caption, /空链表/)
})
check('values 只有 1 个元素 → 1 轮完成，prev 指向唯一节点', () => {
  const single = rl.buildFrames({ values: [7], picks: [rl.ACTIONS.SAVE_NEXT] })
  assert.equal(single.length, 4)
  const last = single[single.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.pointers, [{ name: 'prev', at: 'n0' }])
})
check('values 有重复值 → id 与值无关，节点身份不受影响', () => {
  const dup = rl.buildFrames({ values: [3, 3, 3], picks: rlSave().slice(0, 3) })
  const last = dup[dup.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.nodes.map((n) => n.id), ['n0', 'n1', 'n2'])
})
check('picks 超过所需轮数 → 多余的被忽略', () => {
  const extra = rlSave()
  extra.push(rl.ACTIONS.SAVE_NEXT, rl.ACTIONS.SAVE_NEXT)
  assert.equal(rl.buildFrames({ picks: extra }).length, 16)
})

// ============================================================
// 演示：环形链表（141）。
// 汇总与 exit 保持在文件最末尾，所有分组跑完才出结论。
// ============================================================
const lc = await import('../src/demos/linked-list/linked-cycle/engine.js')

console.log('\n[11] 141 环形链表 · 有环全程')
check('初始帧：slow/fast 同在 n0，4 条边，最后一条 n3 → n1，ask 非空', () => {
  const f0 = lc.buildFrames()[0]
  assert.equal(f0.pointers.find((p) => p.name === 'slow').at, 'n0')
  assert.equal(f0.pointers.find((p) => p.name === 'fast').at, 'n0')
  assert.equal(f0.links.length, 4)
  assert.equal(f0.links[3].from, 'n3')
  assert.equal(f0.links[3].to, 'n1')
  assert.ok(f0.ask !== null)
})
check('第 1 轮答对：slow 在 n1，fast 在 n2，met=false', () => {
  const r1 = lc.buildFrames({ picks: ['n2'] })
  assert.equal(r1.length, 4) // 1 初始 + 3 帧
  const last = r1[r1.length - 1]
  assert.equal(last.pointers.find((p) => p.name === 'slow').at, 'n1')
  assert.equal(last.pointers.find((p) => p.name === 'fast').at, 'n2')
  assert.equal(last.met, false)
})
check('第 2 轮答对：fast 绕回 n1（不是 n3、不是 null）', () => {
  const r2 = lc.buildFrames({ picks: ['n2', 'n1'] })
  assert.equal(r2.length, 7)
  const last = r2[r2.length - 1]
  assert.equal(last.pointers.find((p) => p.name === 'slow').at, 'n2')
  assert.equal(last.pointers.find((p) => p.name === 'fast').at, 'n1')
})
check('第 3 轮答对：met=true、done=true，slow 与 fast 同在 n3', () => {
  const r3 = lc.buildFrames({ picks: ['n2', 'n1', 'n3'] })
  assert.equal(r3.length, 10)
  const last = r3[r3.length - 1]
  assert.equal(last.met, true)
  assert.equal(last.done, true)
  assert.equal(last.ask, null)
  assert.equal(last.pointers.find((p) => p.name === 'slow').at, 'n3')
  assert.equal(last.pointers.find((p) => p.name === 'fast').at, 'n3')
})
check('全程 nodes 的顺序与 id 从未改变', () => {
  lc.buildFrames({ picks: ['n2', 'n1', 'n3'] }).forEach((f) => {
    assert.deepEqual(f.nodes.map((n) => n.id), ['n0', 'n1', 'n2', 'n3'])
    assert.deepEqual(f.nodes.map((n) => n.value), [3, 2, 0, -4])
  })
})

console.log('\n[12] 141 · checkPick 的分支')
check('点相邻节点 → 提示 fast 每轮走 2 步', () => {
  const r = lc.checkPick(lc.buildFrames()[0], 'n1')
  assert.equal(r.ok, false)
  assert.match(r.message, /2 步/)
})
check('点正确落点 → ok、message 为空串', () => {
  const r = lc.checkPick(lc.buildFrames()[0], 'n2')
  assert.equal(r.ok, true)
  assert.equal(r.message, '')
})
check('点其它节点 → 说清两步路线和正确答案', () => {
  const r = lc.checkPick(lc.buildFrames()[0], 'n0')
  assert.equal(r.ok, false)
  assert.match(r.message, /fast 从 3 出发/)
  assert.match(r.message, /正确答案是「0」/)
})
check('点了「走出链表」但答案是节点 → 提示不是空', () => {
  const r = lc.checkPick(lc.buildFrames()[0], lc.OUT)
  assert.equal(r.ok, false)
  assert.match(r.message, /不是空/)
})
check('done 之后再点 → 提示「重来」', () => {
  const r3 = lc.buildFrames({ picks: ['n2', 'n1', 'n3'] })
  const r = lc.checkPick(r3[r3.length - 1], 'n0')
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})

console.log('\n[13] 141 · 无环与边界')
check('pos=-1：答对两轮后结束，done=true、met=false、fast 的 at 为 null', () => {
  const out = lc.buildFrames({ pos: lc.NO_CYCLE_POS, picks: ['n2', lc.OUT] })
  assert.equal(out.length, 7)
  const last = out[out.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.met, false)
  assert.equal(last.pointers.find((p) => p.name === 'fast').at, null)
})
check('pos=-1 且节点数是奇数 → 也不崩，同样以 fast 出链结束', () => {
  const odd = lc.buildFrames({ values: [3, 2, 0, -4, 5], pos: lc.NO_CYCLE_POS, picks: ['n2', 'n4', lc.OUT] })
  const last = odd[odd.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.met, false)
})
check('空数组 → 1 帧且 done，不抛异常', () => {
  const empty = lc.buildFrames({ values: [] })
  assert.equal(empty.length, 1)
  assert.equal(empty[0].done, true)
})
check('单节点自环 → 第 1 轮立刻相遇', () => {
  const self = lc.buildFrames({ values: [7], pos: 0, picks: ['n0'] })
  assert.equal(self.length, 4)
  const last = self[self.length - 1]
  assert.equal(last.met, true)
  assert.equal(last.pointers.find((p) => p.name === 'slow').at, 'n0')
  assert.equal(last.pointers.find((p) => p.name === 'fast').at, 'n0')
})
check('超长 picks / 不存在的节点 id → 多余与非法都被静默忽略', () => {
  const dirty = lc.buildFrames({ picks: ['n9', 'n2', 'xx', 'n1', 'n3', 'n0'] })
  assert.equal(dirty.length, 10)
})

// ============================================================
// 演示：两数之和 II（167）。
// ============================================================
const ts = await import('../src/demos/array/two-sum-sorted/engine.js')

console.log('\n[14] 167 两数之和 II · 帧序列')
check('初始帧：left=0、right=3、sum=17、eliminated 为空', () => {
  const f0 = ts.buildFrames()[0]
  assert.equal(f0.left, 0)
  assert.equal(f0.right, 3)
  assert.equal(f0.sum, 17)
  assert.deepEqual(f0.eliminated, [])
  assert.equal(f0.found, false)
  assert.equal(f0.dead, false)
})
check('第 1 轮选 right 后：right=2、sum=13', () => {
  const f = ts.buildFrames({ picks: ['right'] })
  const last = f[f.length - 1]
  assert.equal(last.right, 2)
  assert.equal(last.sum, 13)
  assert.equal(last.left, 0)
})
check('第 2 轮选 right 后：right=1、sum=9、found=true', () => {
  const f = ts.buildFrames({ picks: ['right', 'right'] })
  assert.equal(f.length, 3) // 1 初始 + 2 次移动
  const last = f[f.length - 1]
  assert.equal(last.right, 1)
  assert.equal(last.sum, 9)
  assert.equal(last.found, true)
})
check('第 2 帧的 eliminated 恰好是 [3]（left/right 本身不算排除）', () => {
  const f = ts.buildFrames({ picks: ['right'] })
  assert.deepEqual(f[1].eliminated, [3])
})

console.log('\n[15] 167 · checkPick 的分支')
check('sum>target 时选 left → 讲升序 / 更大', () => {
  const r = ts.checkPick(ts.buildFrames()[0], 'left')
  assert.equal(r.ok, false)
  assert.match(r.message, /升序|更大/)
})
check('正确方向 → ok、message 为空串', () => {
  const r = ts.checkPick(ts.buildFrames()[0], 'right')
  assert.equal(r.ok, true)
  assert.equal(r.message, '')
})
check('sum<target 时选 right → 讲「让和变大」', () => {
  const f = ts.buildFrames({ target: 100 })
  const r = ts.checkPick(f[0], 'right')
  assert.equal(r.ok, false)
  assert.match(r.message, /变大/)
})
check('found 之后 → 提示「重来」', () => {
  const f = ts.buildFrames({ picks: ['right', 'right'] })
  const r = ts.checkPick(f[f.length - 1], 'right')
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})
check('非法方向 → 不是合法方向', () => {
  const r = ts.checkPick(ts.buildFrames()[0], 'up')
  assert.equal(r.ok, false)
  assert.match(r.message, /合法/)
})

console.log('\n[16] 167 · 边界情况')
check('长度 <2 → 1 帧 dead，不抛异常', () => {
  const one = ts.buildFrames({ numbers: [5] })
  assert.equal(one.length, 1)
  assert.equal(one[0].dead, true)
  const zero = ts.buildFrames({ numbers: [] })
  assert.equal(zero.length, 1)
  assert.equal(zero[0].dead, true)
})
check('无解数据 → left 追上 right 时 dead', () => {
  const f = ts.buildFrames({ numbers: [1, 2], target: 100, picks: ['left'] })
  const last = f[f.length - 1]
  assert.equal(last.dead, true)
  assert.equal(last.found, false)
})
check('相同值元素 [3,3] target 6 → 首帧即命中', () => {
  const f = ts.buildFrames({ numbers: [3, 3], target: 6 })
  assert.equal(f[0].found, true)
  assert.equal(f[0].sum, 6)
})
check('负数数组与负目标 → 比较逻辑同样收敛', () => {
  const f = ts.buildFrames({ numbers: [-5, -2, 1, 4], target: -7, picks: ['right', 'right'] })
  const last = f[f.length - 1]
  assert.equal(last.found, true)
  assert.equal(last.sum, -7)
  assert.equal(last.left, 0)
  assert.equal(last.right, 1)
})
check('非法 / 答错的 pick 静默跳过，超长 picks 忽略多余', () => {
  const clean = ts.buildFrames({ picks: ['right', 'right'] })
  const dirty = ts.buildFrames({ picks: ['left', 'right', 'up', 'right', 'right'] })
  assert.equal(dirty.length, clean.length)
  assert.equal(dirty[dirty.length - 1].found, true)
})

// ============================================================
// 演示：合并两个有序链表（21）。
// ============================================================
const mt = await import('../src/demos/linked-list/merge-two-lists/engine.js')
const MT_FULL = ['a0', 'b0', 'a1', 'b1', 'a2'] // 5 次决策 + 1 帧自动收尾

console.log('\n[17] 21 合并两个有序链表 · 帧序列')
check('初始帧：a0/a1/a2 在 row 0 的 col 0/1/2，b0/b1/b2 在 row 1，结果行为空，tail 为 null', () => {
  const f0 = mt.buildFrames()[0]
  const by = (id) => f0.nodes.find((n) => n.id === id)
  assert.deepEqual(['a0', 'a1', 'a2'].map(by).map((n) => [n.row, n.col]), [[0, 0], [0, 1], [0, 2]])
  assert.deepEqual(['b0', 'b1', 'b2'].map(by).map((n) => [n.row, n.col]), [[1, 0], [1, 1], [1, 2]])
  assert.equal(f0.nodes.filter((n) => n.row === 2).length, 0)
  assert.equal(f0.pointers.find((p) => p.name === 'tail').at, null)
  assert.equal(f0.pointers.find((p) => p.name === 'l1').at, 'a0')
  assert.equal(f0.pointers.find((p) => p.name === 'l2').at, 'b0')
})
check('第 1 轮取 a0：a0 的 row→2、col→0，l1 指向 a1', () => {
  const f = mt.buildFrames({ picks: ['a0'] })
  const last = f[f.length - 1]
  const a0 = last.nodes.find((n) => n.id === 'a0')
  assert.equal(a0.row, 2)
  assert.equal(a0.col, 0)
  assert.equal(last.pointers.find((p) => p.name === 'l1').at, 'a1')
  assert.equal(last.mergedCount, 1)
})
check('第 2 轮取 b0 而非 a1（2 < 3），取 a1 会被静默跳过', () => {
  const right = mt.buildFrames({ picks: ['a0', 'b0'] })
  assert.equal(right[right.length - 1].pointers.find((p) => p.name === 'l2').at, 'b1')
  const b0 = right[right.length - 1].nodes.find((n) => n.id === 'b0')
  assert.equal(b0.row, 2)
  assert.equal(b0.col, 1)
  const wrong = mt.buildFrames({ picks: ['a0', 'a1'] })
  assert.equal(wrong.length, right.length - 1) // a1 不是该取的 → 只有初始 + 1 帧
})
check('全部完成后：done，row 2 有 6 个节点，col 依次 0–5，值 1..6', () => {
  const f = mt.buildFrames({ picks: MT_FULL })
  assert.equal(f.length, 7) // 1 初始 + 5 决策 + 1 自动收尾
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  const row2 = last.nodes.filter((n) => n.row === 2).sort((x, y) => x.col - y.col)
  assert.deepEqual(row2.map((n) => n.col), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(row2.map((n) => n.value), [1, 2, 3, 4, 5, 6])
  assert.equal(last.pointers.find((p) => p.name === 'l1').at, null)
})
check('全程节点总数 6、id 集合不变（移动而非复制）', () => {
  const ids = new Set(['a0', 'a1', 'a2', 'b0', 'b1', 'b2'])
  mt.buildFrames({ picks: MT_FULL }).forEach((fr) => {
    assert.equal(fr.nodes.length, 6)
    fr.nodes.forEach((n) => assert.ok(ids.has(n.id)))
  })
})

console.log('\n[18] 21 · checkPick 的分支')
check('选较大的一边 → 讲升序', () => {
  const r = mt.checkPick(mt.buildFrames()[0], 'b0') // 1 vs 2，b0 是较大的
  assert.equal(r.ok, false)
  assert.match(r.message, /升序/)
})
check('选较小的一边 → ok、message 为空串', () => {
  const r = mt.checkPick(mt.buildFrames()[0], 'a0')
  assert.equal(r.ok, true)
  assert.equal(r.message, '')
})
check('选非链头节点（a2）→ 只有链头在候选里', () => {
  const r = mt.checkPick(mt.buildFrames()[0], 'a2')
  assert.equal(r.ok, false)
  assert.match(r.message, /候选/)
})
check('不存在的 id → 节点不存在', () => {
  const r = mt.checkPick(mt.buildFrames()[0], 'z9')
  assert.equal(r.ok, false)
  assert.match(r.message, /不存在/)
})
check('done 之后 → 提示「重来」', () => {
  const f = mt.buildFrames({ picks: MT_FULL })
  const r = mt.checkPick(f[f.length - 1], 'a0')
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})

console.log('\n[19] 21 · 边界情况')
check('一条链为空 → 0 次决策直接完成，另一条整段搬到结果行', () => {
  const f = mt.buildFrames({ listA: [], listB: [1, 2] })
  assert.equal(f.length, 2) // 1 初始 + 1 自动收尾
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.mergedCount, 2)
  const row2 = last.nodes.filter((n) => n.row === 2).sort((a, b) => a.col - b.col)
  assert.deepEqual(row2.map((n) => n.id), ['b0', 'b1'])
})
check('两条都为空 → 1 帧 done，不抛异常', () => {
  const f = mt.buildFrames({ listA: [], listB: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
})
check('重复值相等时固定取 list1 的', () => {
  const f = mt.buildFrames({ listA: [1, 1], listB: [1], picks: ['a0', 'a1'] })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  const row2 = last.nodes.filter((n) => n.row === 2).sort((x, y) => x.col - y.col)
  assert.deepEqual(row2.map((n) => n.id), ['a0', 'a1', 'b0'])
  const tie = mt.checkPick(mt.buildFrames({ listA: [1, 1], listB: [1] })[0], 'b0')
  assert.equal(tie.ok, false)
  const tieRight = mt.checkPick(mt.buildFrames({ listA: [1, 1], listB: [1] })[0], 'a0')
  assert.equal(tieRight.ok, true)
})
check('其中一条只有 1 个节点 / 已搬走的节点再点 / 超长 picks → 都不崩', () => {
  const f = mt.buildFrames({ listA: [2], listB: [1, 3], picks: ['b0', 'a0', 'b0', 'a0'] })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.mergedCount, 3)
  assert.equal(f.length, 4) // 1 初始 + 2 决策 + 1 自动收尾，多余 pick 全部忽略
})

// ============================================================
// 演示：有效的括号（20）。
// ============================================================
const vp = await import('../src/demos/stack/valid-parentheses/engine.js')

console.log('\n[20] 20 有效的括号 · 有效串全程')
check('初始帧：cursor=0、栈空、phase=ask、valid=null', () => {
  const f0 = vp.buildFrames()[0]
  assert.equal(f0.cursor, 0)
  assert.deepEqual(f0.stack, [])
  assert.equal(f0.phase, 'ask')
  assert.equal(f0.valid, null)
  assert.equal(f0.chars.length, 6)
})
check('依次 push×3 后：栈深 3、栈顶是 {（底到顶为 ( [ {）', () => {
  const f = vp.buildFrames({ picks: ['push', 'push', 'push'] })
  const last = f[f.length - 1]
  assert.equal(f.length, 4)
  assert.equal(last.stack.length, 3)
  assert.deepEqual(last.stack.map((s) => s.value), ['(', '[', '{'])
  assert.equal(last.cursor, 3)
  assert.equal(last.chars.filter((c) => c.consumed).length, 3)
})
check('继续 pop×3 后：done、valid=true、栈空、共 7 帧', () => {
  const f = vp.buildFrames({ picks: ['push', 'push', 'push', 'pop', 'pop', 'pop'] })
  const last = f[f.length - 1]
  assert.equal(f.length, 7)
  assert.equal(last.phase, 'done')
  assert.equal(last.valid, true)
  assert.deepEqual(last.stack, [])
  assert.equal(last.cursor, 6)
})

console.log('\n[21] 20 · 无效路径')
check('([)] 第 3 个字符（)）的正确答案是 invalid，不是 pop', () => {
  const mid = vp.buildFrames({ text: '([)]', picks: ['push', 'push'] })[2]
  assert.equal(mid.cursor, 2)
  assert.equal(vp.checkPick(mid, 'invalid').ok, true)
  assert.equal(vp.checkPick(mid, 'pop').ok, false)
})
check('([)] 中途选 invalid 后：valid=false，reason 提到不配对', () => {
  const f = vp.buildFrames({ text: '([)]', picks: ['push', 'push', 'invalid'] })
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.equal(last.valid, false)
  assert.match(last.reason, /不配对/)
})
check('(() 全部走完：valid=false，reason 提到「栈里还剩」或「没等到」', () => {
  const f = vp.buildFrames({ text: '(()', picks: ['push', 'push', 'pop'] })
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.equal(last.valid, false)
  assert.match(last.reason, /栈里还剩|没等到/)
})
check('))) 第一个字符就该判 invalid', () => {
  const f0 = vp.buildFrames({ text: ')))' })[0]
  assert.equal(vp.checkPick(f0, 'invalid').ok, true)
  const f = vp.buildFrames({ text: ')))', picks: ['invalid'] })
  assert.equal(f[f.length - 1].valid, false)
})
check('单个字符 ( 或 ) 都不崩，按规则走', () => {
  const onlyLeft = vp.buildFrames({ text: '(', picks: ['push'] })
  assert.equal(onlyLeft[onlyLeft.length - 1].valid, false)
  const onlyRight = vp.buildFrames({ text: ')', picks: ['invalid'] })
  assert.equal(onlyRight[onlyRight.length - 1].valid, false)
})
check('含非括号字符 (a) → 判无效且不抛异常', () => {
  const f = vp.buildFrames({ text: '(a)', picks: ['push', 'invalid'] })
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.equal(last.valid, false)
  assert.match(last.reason, /不是括号/)
})

console.log('\n[22] 20 · checkPick 分支与边界')
check('该 invalid 时选 pop → 点明「弹出掩盖问题」', () => {
  const mid = vp.buildFrames({ text: '([)]', picks: ['push', 'push'] })[2]
  const r = vp.checkPick(mid, 'pop')
  assert.equal(r.ok, false)
  assert.match(r.message, /掩盖/)
})
check('该 push 却选 pop / 该 pop 却选 push → 都被拒并说清原因', () => {
  const f0 = vp.buildFrames()[0]
  assert.equal(vp.checkPick(f0, 'pop').ok, false)
  assert.match(vp.checkPick(f0, 'pop').message, /左括号/)
  const mid = vp.buildFrames({ text: '()', picks: ['push'] })[1] // 当前字符是 )
  const r = vp.checkPick(mid, 'push')
  assert.equal(r.ok, false)
  assert.match(r.message, /不能入栈/)
})
check('空字符串 → 1 帧、done、valid=true', () => {
  const f = vp.buildFrames({ text: '' })
  assert.equal(f.length, 1)
  assert.equal(f[0].phase, 'done')
  assert.equal(f[0].valid, true)
})
check('done 之后 → 提示重来；非法动作名 → 提示不合法', () => {
  const done = vp.buildFrames({ text: '()', picks: ['push', 'pop'] })[2]
  assert.equal(done.phase, 'done')
  assert.equal(vp.checkPick(done, 'push').ok, false)
  assert.match(vp.checkPick(done, 'push').message, /重来/)
  const r = vp.checkPick(vp.buildFrames()[0], 'jump')
  assert.equal(r.ok, false)
  assert.match(r.message, /合法/)
})
check('非法 / 答错的 pick 静默跳过，超长忽略，帧数与纯正确序列一致', () => {
  const clean = vp.buildFrames({ picks: ['push', 'push', 'push', 'pop', 'pop', 'pop'] })
  const dirty = vp.buildFrames({
    picks: ['pop', 'push', 'jump', 'push', 'push', 'invalid', 'pop', 'pop', 'pop', 'push'],
  })
  assert.equal(dirty.length, clean.length)
  assert.equal(dirty[dirty.length - 1].valid, true)
})
check('8 个左括号（超过视觉容量 6）→ 逻辑照常走完，不丢帧', () => {
  const f = vp.buildFrames({ text: '((((((((', picks: Array.from({ length: 8 }, () => 'push') })
  const last = f[f.length - 1]
  assert.equal(f.length, 9)
  assert.equal(last.stack.length, 8)
  assert.equal(last.valid, false)
})

// ============================================================
// 演示：每日温度（739）。
// ============================================================
const dt = await import('../src/demos/stack/daily-temperatures/engine.js')
// 默认数据的正确决策序列：i=1..7 依次是 弹/弹/压/压/弹/弹/压（i=0 由引擎自动压入）
const DT_FULL = ['pop', 'pop', 'push', 'push', 'pop', 'pop', 'push']

console.log('\n[23] 739 每日温度 · 帧序列')
check('初始帧：cursor=0、栈空、answers 全为 null、phase=ask', () => {
  const f0 = dt.buildFrames()[0]
  assert.equal(f0.cursor, 0)
  assert.deepEqual(f0.stack, [])
  assert.equal(f0.phase, 'ask')
  assert.deepEqual(f0.answers, [null, null, null, null, null, null, null, null])
})
check('全部正确推完后：answers 深等于 [1,1,4,2,1,1,0,0]，共 15 帧', () => {
  const f = dt.buildFrames({ picks: DT_FULL })
  assert.equal(f.length, 15) // 1 初始 + 1 自动首压 + 12 轮内帧 + 1 收尾并入最后一压
  assert.deepEqual(f[f.length - 1].answers, [1, 1, 4, 2, 1, 1, 0, 0])
})
check('第 5 天（72°）那一轮产出 3 帧：弹 4、弹 3、压 5', () => {
  const before = dt.buildFrames({ picks: ['pop', 'pop', 'push', 'push'] })
  assert.equal(before.length, 8)
  const after = dt.buildFrames({ picks: ['pop', 'pop', 'push', 'push', 'pop'] })
  assert.equal(after.length, 11) // 一轮 +3 帧
  assert.equal(after[8].answers[4], 1) // 弹出第 4 个下标，答案 5−4=1
  assert.equal(after[9].answers[3], 2) // 又弹第 3 个下标，答案 5−3=2
  const last = after[after.length - 1]
  assert.deepEqual(last.stack.map((s) => s.index), [2, 5])
})
check('ans[3] = 2（5−3 的下标差，不是温度差），ans[2] = 4（6−2）', () => {
  const f = dt.buildFrames({ picks: DT_FULL })
  assert.equal(f[f.length - 1].answers[3], 2)
  assert.equal(f[f.length - 1].answers[2], 4)
})
check('走完后栈里剩 [6,7] 两个下标，phase=done', () => {
  const f = dt.buildFrames({ picks: DT_FULL })
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.deepEqual(last.stack.map((s) => s.index), [6, 7])
  assert.equal(last.cursor, 8)
})

console.log('\n[24] 739 · checkPick 的分支')
check('该 pop 却选 push → 讲「等到」与「埋」', () => {
  const f1 = dt.buildFrames({ picks: [] })[1] // 自动首压后：栈 [0]，当前 74° > 73°
  const r = dt.checkPick(f1, 'push')
  assert.equal(r.ok, false)
  assert.match(r.message, /等到|埋/)
})
check('该 push 却选 pop → 讲弹掉也解决不了', () => {
  const f5 = dt.buildFrames({ picks: ['pop', 'pop'] })[5] // 栈 [2]，当前 71° < 75°
  const r = dt.checkPick(f5, 'pop')
  assert.equal(r.ok, false)
  assert.match(r.message, /解决不了|丢掉/)
})
check('栈空时选 pop → 栈是空的；选 push → ok', () => {
  const f0 = dt.buildFrames()[0]
  const r = dt.checkPick(f0, 'pop')
  assert.equal(r.ok, false)
  assert.match(r.message, /栈是空的/)
  assert.equal(dt.checkPick(f0, 'push').ok, true)
})
check('done 之后 → 提示重来；非法动作名 → 提示不合法', () => {
  const done = dt.buildFrames({ picks: DT_FULL }).pop()
  assert.equal(dt.checkPick(done, 'pop').ok, false)
  assert.match(dt.checkPick(done, 'pop').message, /重来/)
  const r = dt.checkPick(dt.buildFrames()[0], 'jump')
  assert.equal(r.ok, false)
  assert.match(r.message, /合法/)
})

console.log('\n[25] 739 · 边界数据')
check('全相同 / 严格递减 / 严格递增 → [0,0,0] / [0,0,0] / [1,1,0]', () => {
  const same = dt.buildFrames({ temps: [5, 5, 5], picks: ['push', 'push'] })
  assert.deepEqual(same[same.length - 1].answers, [0, 0, 0])
  const down = dt.buildFrames({ temps: [5, 4, 3], picks: ['push', 'push'] })
  assert.deepEqual(down[down.length - 1].answers, [0, 0, 0])
  const up = dt.buildFrames({ temps: [1, 2, 3], picks: ['pop', 'pop'] })
  assert.deepEqual(up[up.length - 1].answers, [1, 1, 0])
})
check('只有 1 天 → 答案 [0]，2 帧收尾', () => {
  const f = dt.buildFrames({ temps: [5] })
  assert.equal(f.length, 2)
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.deepEqual(last.answers, [0])
})
check('负数温度 → 比较逻辑一致', () => {
  const f = dt.buildFrames({ temps: [-3, -5, 0], picks: ['push', 'pop'] })
  assert.deepEqual(f[f.length - 1].answers, [2, 1, 0])
})
check('空数组 → 1 帧、done、答案为空', () => {
  const f = dt.buildFrames({ temps: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].phase, 'done')
  assert.deepEqual(f[0].answers, [])
})
check('非法 / 答错的 pick 静默跳过，超长忽略', () => {
  const clean = dt.buildFrames({ picks: DT_FULL })
  const dirty = dt.buildFrames({ picks: ['push', 'pop', 'jump', 'pop', 'push', 'push', 'pop', 'pop', 'push', 'pop'] })
  assert.equal(dirty.length, clean.length)
  assert.deepEqual(dirty[dirty.length - 1].answers, [1, 1, 4, 2, 1, 1, 0, 0])
})

// ============================================================
// 演示：滑动窗口最大值（239）。
// ============================================================
const sw = await import('../src/demos/queue/sliding-window-max/engine.js')
// 官方数据 10 次决策：i=1 弹；i=2,3 压；i=4 弹×3（弹空自动压）；i=5 压；i=6 弹×2；i=7 弹
const SW_FULL = ['pop-tail', 'push', 'push', 'pop-tail', 'pop-tail', 'pop-tail', 'push', 'pop-tail', 'pop-tail', 'pop-tail']
// 第二组 6 次决策：i=1,2 压；i=3 弹+压；i=4 弹×2（弹空自动压）
const SW_EXPIRE = ['push', 'push', 'pop-tail', 'push', 'pop-tail', 'pop-tail']

console.log('\n[26] 239 滑动窗口最大值 · 帧序列')
check('官方数据走完：answers=[3,3,5,5,6,7]，共 16 帧，phase=done', () => {
  const f = sw.buildFrames({ picks: SW_FULL })
  assert.equal(f.length, 16)
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.deepEqual(last.answers, [3, 3, 5, 5, 6, 7])
})
check('第二组走完：answers=[5,3,4]', () => {
  const f = sw.buildFrames({ nums: sw.EXPIRE_NUMS, k: sw.EXPIRE_K, picks: SW_EXPIRE })
  const last = f[f.length - 1]
  assert.equal(last.phase, 'done')
  assert.deepEqual(last.answers, [5, 3, 4])
})
check('官方数据 i=4（5）那一轮产出 4 帧：弹 3、弹 2、弹 1、压 4', () => {
  const before = sw.buildFrames({ picks: ['pop-tail', 'push', 'push'] })
  assert.equal(before.length, 6)
  const after = sw.buildFrames({ picks: ['pop-tail', 'push', 'push', 'pop-tail', 'pop-tail', 'pop-tail'] })
  assert.equal(after.length, 10) // 一轮 +4 帧
  assert.equal(after[9].answers[2], 5) // 压入帧里窗口 [2,4] 的答案
  assert.deepEqual(after[9].queue.map((q) => q.index), [4])
})
check('第二组 i=3（2）：存在相邻两帧，队列从含下标 0 变为不含（队首过期）', () => {
  const f = sw.buildFrames({ nums: sw.EXPIRE_NUMS, k: sw.EXPIRE_K, picks: ['push', 'push', 'pop-tail', 'push'] })
  assert.equal(f.length, 7)
  assert.deepEqual(f[5].queue.map((q) => q.index), [0, 1, 3]) // 压入帧：旧队首还在
  assert.deepEqual(f[6].queue.map((q) => q.index), [1, 3]) // 过期帧：左出
  assert.equal(f[6].answers[1], 3)
})
check('queue 队首在前：queue[0] 是最早入队、也是当前窗口最大值的下标', () => {
  const f = sw.buildFrames({ picks: ['pop-tail', 'push', 'push', 'pop-tail', 'pop-tail', 'pop-tail', 'push'] })
  const last = f[f.length - 1] // i=5 压入后：队列 [4,5]
  assert.deepEqual(last.queue.map((q) => q.index), [4, 5])
  assert.equal(last.window.left, 3)
})
check('每一帧：队列下标严格递增、对应值严格递减（官方数据无重复值）', () => {
  sw.buildFrames({ picks: SW_FULL }).forEach((fr) => {
    for (let j = 1; j < fr.queue.length; j += 1) {
      assert.ok(fr.queue[j - 1].index < fr.queue[j].index)
      assert.ok(fr.nums[fr.queue[j - 1].index] > fr.nums[fr.queue[j].index])
    }
  })
})
check('window：窗口未满时为 null，满后 right-left+1 === k', () => {
  const f = sw.buildFrames({ picks: SW_FULL })
  f.forEach((fr) => {
    if (fr.window !== null) assert.equal(fr.window.right - fr.window.left + 1, fr.k)
  })
  assert.equal(f[0].window, null) // 初始帧
  assert.equal(f[1].window, null) // i=0 压入帧：k=3 未满
  assert.equal(f[3].window, null) // i=1 压入帧：仍未满
  assert.ok(f[4].window !== null) // i=2 压入帧：窗口 [0,2] 首次成立
  assert.deepEqual(f[4].window, { left: 0, right: 2 })
})

console.log('\n[27] 239 · checkPick 的分支')
check('该弹尾却选 push → 讲「不可能」或「死路」', () => {
  const f1 = sw.buildFrames()[1] // 队列 [0]，当前 3 > 1
  const r = sw.checkPick(f1, 'push')
  assert.equal(r.ok, false)
  assert.match(r.message, /不可能|死路/)
})
check('该压却选 pop-tail → 讲弹掉没道理', () => {
  const f3 = sw.buildFrames({ picks: ['pop-tail'] })[3] // i=1 弹空自动压入后：队列 [1]，当前 -1 < 3
  const r = sw.checkPick(f3, 'pop-tail')
  assert.equal(r.ok, false)
  assert.match(r.message, /没道理|更可能的答案/)
})
check('队列为空时选 pop-tail → 队列是空的', () => {
  const r = sw.checkPick(sw.buildFrames()[0], 'pop-tail')
  assert.equal(r.ok, false)
  assert.match(r.message, /队列是空的/)
})
check('done 之后 → 提示重来；非法动作名 → 提示不合法', () => {
  const done = sw.buildFrames({ picks: SW_FULL }).pop()
  assert.equal(sw.checkPick(done, 'push').ok, false)
  assert.match(sw.checkPick(done, 'push').message, /重来/)
  const r = sw.checkPick(sw.buildFrames()[0], 'jump')
  assert.equal(r.ok, false)
  assert.match(r.message, /合法/)
})

console.log('\n[28] 239 · 边界数据')
check('k=1 / k=nums.length / k>nums.length → 答案正确且不抛异常', () => {
  const one = sw.buildFrames({ nums: [1, 3, 2], k: 1, picks: ['pop-tail', 'push'] })
  assert.deepEqual(one[one.length - 1].answers, [1, 3, 2])
  const whole = sw.buildFrames({ nums: [2, 1, 3], k: 3, picks: ['push', 'pop-tail', 'pop-tail'] })
  assert.deepEqual(whole[whole.length - 1].answers, [3])
  const over = sw.buildFrames({ nums: [1, 2], k: 5 })
  assert.equal(over.length, 1)
  assert.equal(over[0].phase, 'done')
  assert.deepEqual(over[0].answers, [])
})
check('全相同 / 严格递减 / 严格递增 → [2,2] / [5,4] / [2,3]（相等不弹）', () => {
  const same = sw.buildFrames({ nums: [2, 2, 2], k: 2, picks: ['push', 'push'] })
  assert.deepEqual(same[same.length - 1].answers, [2, 2])
  const down = sw.buildFrames({ nums: [5, 4, 3], k: 2, picks: ['push', 'push'] })
  assert.deepEqual(down[down.length - 1].answers, [5, 4])
  const up = sw.buildFrames({ nums: [1, 2, 3], k: 2, picks: ['pop-tail', 'pop-tail'] })
  assert.deepEqual(up[up.length - 1].answers, [2, 3])
})
check('空数组 → 1 帧、done、不抛异常', () => {
  const f = sw.buildFrames({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].phase, 'done')
})
check('非法 / 答错的 pick 静默跳过，超长忽略', () => {
  const clean = sw.buildFrames({ picks: SW_FULL })
  const dirty = sw.buildFrames({
    picks: ['push', 'pop-tail', 'jump', 'push', 'push', 'pop-tail', 'pop-tail', 'pop-tail', 'push', 'pop-tail', 'pop-tail', 'pop-tail', 'push'],
  })
  assert.equal(dirty.length, clean.length)
  assert.deepEqual(dirty[dirty.length - 1].answers, [3, 3, 5, 5, 6, 7])
})

// ============================================================
// 演示：两数之和（1）、最长连续序列（128）、字母异位词分组（49）。
// ============================================================
const hs = await import('../src/demos/hash/two-sum/engine.js')
const lcseq = await import('../src/demos/hash/longest-consecutive/engine.js')
const ga = await import('../src/demos/hash/group-anagrams/engine.js')

console.log('\n[29] 1 两数之和 · 哈希表')
check('组 A 走完：13 帧，done，答案 [1,2]', () => {
  const f = hs.buildFrames({ picks: ['lookup-first', 'miss', 'miss', 'hit'] })
  assert.equal(f.length, 13)
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.answer, [1, 2])
})
check('组 B 走完：17 帧，答案 [2,3]', () => {
  const f = hs.buildFrames({
    nums: hs.GROUP_B.nums,
    target: hs.GROUP_B.target,
    capacity: hs.GROUP_B.capacity,
    picks: ['lookup-first', 'miss', 'miss', 'miss', 'hit'],
  })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.answer, [2, 3])
})
check('组 B i=1 存 5 后：b1 链为 [1,5]（冲突可见）', () => {
  const f = hs.buildFrames({
    nums: hs.GROUP_B.nums,
    target: hs.GROUP_B.target,
    capacity: hs.GROUP_B.capacity,
    picks: ['lookup-first', 'miss', 'miss'],
  })
  assert.deepEqual(f[8].buckets[1].map((n) => n.key), ['1', '5'])
  assert.match(f[8].caption, /冲突|挂在/)
})
check('hash 负数安全：hash(-2,4) === 2，hash(100,8) === 4', () => {
  assert.equal(hs.hash(-2, 4), 2)
  assert.equal(hs.hash(100, 8), 4)
})
check('store-first 被拒，文案点破 [0,0]', () => {
  const r = hs.checkPick(hs.buildFrames()[0], 'store-first')
  assert.equal(r.ok, false)
  assert.match(r.message, /\[0,0\]/)
})
check('答错的 pick 不产帧（frames.length 不变）', () => {
  const right = hs.buildFrames({ picks: ['lookup-first'] })
  const wrong = hs.buildFrames({ picks: ['lookup-first', 'hit'] })
  assert.equal(wrong.length, right.length)
})
check('checkPick lookup 答错：讲桶与链的真相', () => {
  const f = hs.buildFrames({ picks: ['lookup-first', 'miss', 'miss'] }) // f9：问补数 2，桶 2 里有 2
  const r1 = hs.checkPick(f[9], 'miss')
  assert.equal(r1.ok, false)
  assert.match(r1.message, /就有 2/)
  const f1 = hs.buildFrames({ picks: ['lookup-first'] })[1] // 问补数 3，桶 3 空
  const r2 = hs.checkPick(f1, 'hit')
  assert.equal(r2.ok, false)
  assert.match(r2.message, /是空的/)
})
check('无解 [1,5,3,6]/100：走到 done 且答案为空', () => {
  const f = hs.buildFrames({
    nums: hs.GROUP_B.nums,
    target: 100,
    capacity: hs.GROUP_B.capacity,
    picks: ['lookup-first', 'miss', 'miss', 'miss', 'miss'],
  })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.answer, null)
})
check('空数组 → 1 帧 done', () => {
  const f = hs.buildFrames({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
})
check('done 之后 → 提示重来', () => {
  const done = hs.buildFrames({ picks: ['lookup-first', 'miss', 'miss', 'hit'] }).pop()
  const r = hs.checkPick(done, 'hit')
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})

console.log('\n[30] 128 最长连续序列')
check('默认数据走完：best 4（段 1..4），共 20 帧', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.equal(last.best, 4)
  assert.deepEqual(last.bestRange, [1, 4])
  assert.equal(f.length, 20)
})
check('建表后桶号：100→b4、4→b4（同桶冲突）、200→b0、1→b1、3→b3、2→b2', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  assert.deepEqual(f[6].buckets[4].map((n) => n.key), ['100', '4'])
  assert.deepEqual(f[6].buckets[0].map((n) => n.key), ['200'])
  assert.deepEqual(f[6].buckets[1].map((n) => n.key), ['1'])
  assert.deepEqual(f[6].buckets[3].map((n) => n.key), ['3'])
  assert.deepEqual(f[6].buckets[2].map((n) => n.key), ['2'])
  assert.match(f[2].caption, /冲突|挂在/)
})
check('起点判定：100/200/1 是起点（no 对），4/3/2 不是（yes 对）', () => {
  // 推演串能走到底且 best=4，本身就是六个判定全对的证据；再单独验证答错会卡住
  const stuck = lcseq.buildFrames({ picks: ['yes'] })
  assert.equal(stuck.length, 8) // 初始 1 + 建表 6 + 提问 1，答错不产帧
})
check('从 1 数段：3 张数段帧，run 逐帧 2 → 3 → 4', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  assert.equal(f[14].run, 2)
  assert.equal(f[15].run, 3)
  assert.equal(f[16].run, 4)
  assert.equal(f[17].best, 4)
})
check('checkPick start 答错引用桶号讲真相', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1'] }) // f9：问 4 的 n-1=3，3 在 b3
  const r = lcseq.checkPick(f[9], 'no')
  assert.equal(r.ok, false)
  assert.match(r.message, /3 就存|在的/)
  const f7 = lcseq.buildFrames()[7] // 问 100 的 99，不在
  const r2 = lcseq.checkPick(f7, 'yes')
  assert.equal(r2.ok, false)
  assert.match(r2.message, /不在/)
})
check('checkPick count 答错不直接报答案', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no'] }) // f13：问 1 的段长（正确 4）
  const r = lcseq.checkPick(f[13], 'count-2')
  assert.equal(r.ok, false)
  assert.match(r.message, /一个一个/)
})
check('[] → 0；[7,7,7] → 1（Set 不存两份）；[0,-1] → 2（负数哈希）', () => {
  const empty = lcseq.buildFrames({ nums: [] })
  assert.equal(empty[0].done, true)
  assert.equal(empty[0].best, 0)
  const dup = lcseq.buildFrames({ nums: [7, 7, 7], picks: ['no', 'count-1'] })
  const dupLast = dup[dup.length - 1]
  assert.equal(dupLast.best, 1)
  assert.deepEqual(dupLast.buckets[7].map((n) => n.key), ['7'])
  const neg = lcseq.buildFrames({ nums: [0, -1], picks: ['yes', 'no', 'count-2'] })
  assert.equal(neg[neg.length - 1].best, 2)
  assert.deepEqual(neg[neg.length - 1].buckets[7].map((n) => n.key), ['-1'])
})
check('建表阶段：初始 1 帧 + 每数 1 帧共 6 帧，第 8 帧才是 scan 提问', () => {
  const f = lcseq.buildFrames()
  assert.equal(f.length, 8)
  for (let i = 1; i <= 6; i += 1) assert.equal(f[i].decision, null)
  assert.equal(f[7].decision, 'start')
  assert.equal(f[7].stage, 'scan')
})
check('结算帧 best 逐轮推进：100 段 best=1，200 段 best 保持 1，1 段 best=4', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  assert.equal(f[9].best, 1)
  assert.equal(f[12].best, 1)
  assert.equal(f[17].best, 4)
})
check('数段帧的 query：亮的是对应桶的节点（phase=hit）', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  assert.equal(f[14].query.bucket, 2)
  assert.equal(f[14].query.phase, 'hit')
  assert.equal(f[15].query.bucket, 3)
  assert.equal(f[16].query.bucket, 4)
})
check('非起点帧点破原因：从 n-1 出发只会更长', () => {
  const f = lcseq.buildFrames({ picks: ['no', 'count-1', 'yes', 'no', 'count-1', 'no', 'count-4', 'yes', 'yes'] })
  assert.match(f[10].caption, /不配当起点|更长/)
})

console.log('\n[31] 49 字母异位词分组')
check('走完分 3 组：{eat,tea,ate}、{tan,nat}、{bat}', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  const last = f[f.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.groups, [
    ['eat', 'tea', 'ate'],
    ['tan', 'nat'],
    ['bat'],
  ])
})
check('桶号：aet→b2；ant→b5；abt→b5（和 ant 冲突）', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  const last = f[f.length - 1]
  assert.deepEqual(last.buckets[2].map((n) => n.key), ['aet'])
  assert.deepEqual(last.buckets[5].map((n) => n.key), ['ant', 'abt'])
})
check('hash("eat") === hash("aet") === 2；hash("ant") === 5；hash("abt") === 5', () => {
  assert.equal(ga.hash('eat', 6), ga.hash('aet', 6))
  assert.equal(ga.hash('aet', 6), 2)
  assert.equal(ga.hash('ant', 6), 5)
  assert.equal(ga.hash('abt', 6), 5)
})
check('bat 题眼：建组前 b5 链 [ant]，建组后 [ant, abt]', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  assert.deepEqual(f[21].buckets[5].map((n) => n.key), ['ant'])
  assert.deepEqual(f[22].buckets[5].map((n) => n.key), ['ant', 'abt'])
  assert.match(f[22].caption, /挂在|下面/)
})
check('并入帧：计数增长到 3 个', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  assert.equal(f[14].buckets[2][0].value, '3 个')
})
check('sig-ate 被拒且文案含「字典序」；sig-eat 被拒（没排序）', () => {
  const f0 = ga.buildFrames()[0]
  const r1 = ga.checkPick(f0, 'sig-ate')
  assert.equal(r1.ok, false)
  assert.match(r1.message, /字典序/)
  const r2 = ga.checkPick(f0, 'sig-eat')
  assert.equal(r2.ok, false)
  assert.match(r2.message, /排序|原词/)
})
check('lookup 答错：引用链内容讲真相', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss'] }) // f4：问 tea 的 aet，桶 2 里有
  const r1 = ga.checkPick(f[4], 'miss')
  assert.equal(r1.ok, false)
  assert.match(r1.message, /就有 key 'aet'|就有/)
  const fBat = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit'] }) // f19：问 bat 的 abt，b5 只有 ant
  const r2 = ga.checkPick(fBat[19], 'hit')
  assert.equal(r2.ok, false)
  assert.match(r2.message, /没有 key 'abt'|ant/)
})
check('[] → 0 组；["abc"] → 1 组', () => {
  const empty = ga.buildFrames({ words: [] })
  assert.equal(empty.length, 1)
  assert.equal(empty[0].done, true)
  const one = ga.buildFrames({ words: ['abc'], picks: ['sig-abc', 'miss'] })
  const last = one[one.length - 1]
  assert.equal(last.done, true)
  assert.deepEqual(last.groups, [['abc']])
})
check('答错的 pick 不产帧；done 之后 → 重来', () => {
  const right = ga.buildFrames({ picks: ['sig-aet'] })
  const wrong = ga.buildFrames({ picks: ['sig-aet', 'hit'] })
  assert.equal(wrong.length, right.length)
  const done = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] }).pop()
  const r = ga.checkPick(done, 'hit')
  assert.equal(r.ok, false)
  assert.match(r.message, /重来/)
})
check('signatureOf：eat/tea/ate 的签名都是 aet，bat 是 abt', () => {
  assert.equal(ga.signatureOf('eat'), 'aet')
  assert.equal(ga.signatureOf('tea'), 'aet')
  assert.equal(ga.signatureOf('ate'), 'aet')
  assert.equal(ga.signatureOf('bat'), 'abt')
})
check('bat 轮的定位帧与比对帧：query 指向 b5，比对帧点破「同桶 ≠ 同 key」', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  assert.equal(f[20].query.bucket, 5)
  assert.equal(f[20].query.phase, 'scan')
  assert.equal(f[21].query.checked, 0)
  assert.match(f[21].caption, /不是 abt|不是/)
})
check('建组帧 value 从「1 个」起，链头在前（先存入的在上）', () => {
  const f = ga.buildFrames({ picks: ['sig-aet', 'miss', 'hit', 'miss', 'hit', 'hit', 'miss'] })
  assert.equal(f[3].buckets[2][0].value, '1 个')
  assert.equal(f[3].buckets[2][0].key, 'aet')
})

// —— [32] P9a-1：TreeCanvas 几何契约 + 94 二叉树的中序遍历 ——
// 追加段：不改上面任何已有断言。渲染器纯函数从 src/core/tree-geom.js 直采（selftest 起不了 Vue）。
import * as tg from '../src/core/tree-geom.js'
import {
  buildFrames as t94Build,
  checkPick as t94Check,
  FIXTURE_A as T94_A,
  FIXTURE_B as T94_B,
} from '../src/demos/tree/inorder-traversal/engine.js'

console.log('\n[32] TreeCanvas 几何 + 94 中序遍历')

check('[32.1] 槽位 x：x(L3,d3,k0)=62、x(L3,d3,k1)=128', () => {
  assert.equal(tg.slotX(3, 0, 3), 62)
  assert.equal(tg.slotX(3, 1, 3), 128)
})
check('[32.2] 槽位 x：x(L3,d1)=161、x(L4,d1)=293', () => {
  assert.equal(tg.slotX(1, 0, 3), 161)
  assert.equal(tg.slotX(1, 0, 4), 293)
})
check('[32.3] width(3)=322、width(4)=586、width(5)=1114', () => {
  assert.equal(tg.treeWidth(3), 322)
  assert.equal(tg.treeWidth(4), 586)
  assert.equal(tg.treeWidth(5), 1114)
})
check('[32.4] height(4)=388', () => {
  assert.equal(tg.treeHeight(4), 388)
})
check('[32.5] maxWidth(4)=860 且 scale≈1.47、maxWidth(3)=515', () => {
  assert.equal(tg.treeMaxWidth(4), 860)
  assert.ok(Math.abs(tg.scaleOf(4) - 1.47) < 0.01)
  assert.equal(tg.treeMaxWidth(3), 515)
})
check('[32.6] noScale:true → maxWidth = width（586 / 322）', () => {
  assert.equal(tg.treeMaxWidth(4, { noScale: true }), 586)
  assert.equal(tg.treeMaxWidth(3, { noScale: true }), 322)
})
check('[32.7] 门控：clickable 外的 id 不 emit（纯函数，不起 Vue）', () => {
  assert.equal(tg.clickableGate(['s0'], 's0'), true)
  assert.equal(tg.clickableGate(['s0'], 's1'), false)
  assert.equal(tg.clickableGate([], 's0'), false)
})
check('[32.8] 3.3 数字：出边 ±10、到达 y−6、gutter x=26', () => {
  assert.equal(tg.OUT_DX, 10)
  assert.equal(tg.edgeStartX(293, 'L'), 283)
  assert.equal(tg.edgeStartX(293, 'R'), 303)
  assert.equal(tg.edgeStartY(1), 100) // y(1)=56 + 格高 44
  assert.equal(tg.ARRIVE_LIFT, 6)
  assert.equal(tg.edgeEndY(4), tg.slotY(4) - 6)
  assert.equal(tg.GUTTER_X, 26)
  assert.equal(tg.GUTTER_DY, 26)
})
check('[32.9] 3.3 常量：箭头 8、双虚线口径、线宽 1.5/2、空格 opacity .6、层高 88、格 56×44', () => {
  assert.equal(tg.ARROW_LEN, 8)
  assert.equal(tg.DASH_EDGE, '4 3')
  assert.equal(tg.DASH_CELL, '5 4')
  assert.equal(tg.EDGE_W, 1.5)
  assert.equal(tg.PATH_W, 2)
  assert.equal(tg.EMPTY_OPACITY, 0.6)
  assert.equal(tg.LEVEL_H, 88)
  assert.equal(tg.CELL_W, 56)
  assert.equal(tg.CELL_H, 44)
})
check('[32.10] 热区：L=4 ≈82px ✓ 上限、L=5 ≈43px ✗（深度硬锁的几何依据）', () => {
  assert.ok(Math.abs(tg.hotzone(4) - 82) < 0.5)
  assert.ok(Math.abs(tg.hotzone(5) - 43) < 0.5)
})

const t94a = t94Build({ nums: T94_A })
const t94b = t94Build({ nums: T94_B })

check('[32.11] ⑥ A 解析：真实格 s0=1/s2=2/s5=3，空格恰为 [s1]', () => {
  const real = t94a[0].cells.filter((c) => !c.empty)
  assert.deepEqual(
    real.map((c) => c.id),
    ['s0', 's2', 's5'],
  )
  assert.deepEqual(
    real.map((c) => c.value),
    [1, 2, 3],
  )
  assert.deepEqual(
    t94a[0].cells.filter((c) => c.empty).map((c) => c.id),
    ['s1'],
  )
})
check('[32.12] ⑥⑨ B 解析：7 真实格 + 空格恰为 [s4]', () => {
  const real = t94b[0].cells.filter((c) => !c.empty)
  assert.deepEqual(
    real.map((c) => c.id),
    ['s0', 's1', 's2', 's3', 's5', 's6', 's7'],
  )
  assert.deepEqual(
    real.map((c) => c.value),
    [10, 5, 15, 3, 13, 18, 1],
  )
  assert.deepEqual(
    t94b[0].cells.filter((c) => c.empty).map((c) => c.id),
    ['s4'],
  )
})
check('[32.13] ⑦ 空格只挂在真实父节点的缺失孩子上，且不在第 L 层', () => {
  for (const frames of [t94a, t94b]) {
    const f0 = frames[0]
    const byId = new Map(f0.cells.map((c) => [c.id, c]))
    for (const c of f0.cells.filter((x) => x.empty)) {
      assert.ok(c.d < f0.levels, `${c.id} 落在第 L 层`)
      const parent = byId.get(tg.slotId(c.d - 1, Math.floor(c.k / 2)))
      assert.ok(parent && !parent.empty, `${c.id} 的父节点不是真实格`)
    }
  }
})
check('[32.22] ⑨ 槽号口径：3 必须在 s5（BFS 队列分配，不是堆下标填充）', () => {
  const c3 = t94a[0].cells.find((c) => c.value === 3)
  assert.equal(c3.id, 's5')
  assert.equal(c3.d, 3)
  assert.equal(c3.k, 2)
})
check('[32.14] ① A 全对 → 8 帧 + answer=[1,3,2] + done', () => {
  const f = t94Build({ nums: T94_A, picks: ['s1', 's0', 's5', 's2'] })
  assert.equal(f.length, 8)
  assert.equal(f[7].done, true)
  assert.deepEqual(f[7].seq, [1, 3, 2])
})
check('[32.15] ② B 全对 → 16 帧 + [1,3,5,10,13,15,18]', () => {
  const f = t94Build({ nums: T94_B, picks: ['s7', 's3', 's1', 's4', 's0', 's5', 's2', 's6'] })
  assert.equal(f.length, 16)
  assert.equal(f[15].done, true)
  assert.deepEqual(f[15].seq, [1, 3, 5, 10, 13, 15, 18])
})
check('[32.16] ③ B 开局点祖先 10 → 致命文案点名，且不产帧', () => {
  const r = t94Check(t94b[0], 's0')
  assert.equal(r.ok, false)
  assert.match(r.message, /10/)
  assert.match(r.message, /左子树/)
  assert.equal(t94Build({ nums: T94_B, picks: ['s0'] }).length, 1)
})
check('[32.17] ④ 点已输出的格 → 「已经在答案里了」', () => {
  const f = t94Build({ nums: T94_B, picks: ['s7'] })
  const r = t94Check(f[f.length - 1], 's7')
  assert.equal(r.ok, false)
  assert.match(r.message, /已经在答案里了/)
})
check('[32.18] ⑤ 点不在 clickable 的格 → 静默跳过不产帧不报错', () => {
  assert.equal(t94Build({ nums: T94_A, picks: ['s2'] }).length, 1)
  const mix = t94Build({ nums: T94_A, picks: ['s2', 's1', 's0', 's5', 's2'] })
  assert.equal(mix.length, 8) // 错的不产帧，后面的照常复放
})
check('[32.19] ⑥ [] → 1 帧 done:true', () => {
  const f = t94Build({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
})
check('[32.20] ⑩ 真 5 层数据被拒收：1 帧 done + 「只支持 4 层以内（当前 5 层）」', () => {
  const f = t94Build({ nums: [10, 5, 15, 3, 7, 13, 18, 1, 2, 4, 6, 8, 9, 11, 12, 13] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.match(f[0].caption, /只支持 4 层以内（当前 5 层）/)
})
check('[32.21] ⑧ A 的 s1 轮与 B 的 s4 轮 clickable 写死比对', () => {
  assert.deepEqual(t94a[0].clickable, ['s1']) // A 开局：先确认 1 的左孩子槽
  const a1 = t94Build({ nums: T94_A, picks: ['s1'] })
  assert.deepEqual(a1[a1.length - 1].clickable, ['s0']) // s1 ∅ 轮之后：访问 1
  const b3 = t94Build({ nums: T94_B, picks: ['s7', 's3', 's1'] })
  assert.deepEqual(b3[b3.length - 1].clickable, ['s4']) // 5 访问完 → 轮到确认右孩子槽
  const b4 = t94Build({ nums: T94_B, picks: ['s7', 's3', 's1', 's4'] })
  assert.deepEqual(b4[b4.length - 1].clickable, ['s0']) // s4 ∅ 轮之后：访问 10
})
check('[32.23] 路径线：s5 轮的 ① 帧 s0→s2、s2→s5 转 path，空格边保持 null', () => {
  const f = t94Build({ nums: T94_A, picks: ['s1', 's0', 's5'] })
  const edges = f[4].edges
  assert.equal(edges.find((e) => e.from === 's0' && e.to === 's2').kind, 'path')
  assert.equal(edges.find((e) => e.from === 's2' && e.to === 's5').kind, 'path')
  assert.equal(edges.find((e) => e.to === 's1').kind, 'null')
  assert.equal(edges.length, 3) // s6 在第 L 层不画，边也只有 3 条
})
check('[32.24] 栈：B 的 s7 轮 = 10/5/3/1（#0/#1/#3/#7），s4 轮 = 10/5', () => {
  const f = t94Build({ nums: T94_B, picks: ['s7'] })
  assert.deepEqual(
    f[1].stack.map((s) => `${s.value}@${s.sub}`),
    ['10@#0', '5@#1', '3@#3', '1@#7'],
  )
  const g = t94Build({ nums: T94_B, picks: ['s7', 's3', 's1', 's4'] })
  assert.deepEqual(
    g[7].stack.map((s) => `${s.value}@${s.sub}`),
    ['10@#0', '5@#1'],
  )
})
check('[32.25] 序列输出面：新下标标 ok（seqMark）', () => {
  const f = t94Build({ nums: T94_A, picks: ['s1', 's0'] })
  assert.equal(f[3].seqMark, 0)
  assert.deepEqual(f[3].seq, [1])
  assert.equal(f[2].seqMark, null) // ① 帧还没有新值
})
check('[32.26] marks：① 帧 picked=active、已输出=ok；∅ 轮只亮自己', () => {
  const f = t94Build({ nums: T94_A, picks: ['s1', 's0', 's5'] })
  assert.equal(f[4].marks.s5, 'active')
  assert.equal(f[4].marks.s0, 'ok')
  assert.equal(f[1].marks.s1, 'active')
  assert.equal(f[1].marks.s0, undefined)
})
check('[32.27] done 帧 clickable 清空；A 按 x 从左到右读真实格 = [1,3,2]（题眼）', () => {
  const f = t94Build({ nums: T94_A, picks: ['s1', 's0', 's5', 's2'] })
  assert.deepEqual(f[7].clickable, [])
  const xs = t94a[0].cells
    .filter((c) => !c.empty)
    .map((c) => ({ v: c.value, x: tg.slotX(c.d, c.k, t94a[0].levels) }))
    .sort((p, q) => p.x - q.x)
  assert.deepEqual(
    xs.map((p) => p.v),
    [1, 3, 2],
  )
})
check('[32.28] 修补单：边端点全部有限，A 恰 3 条边、B 恰 7 条（与组件同一条 layoutEdges 路径）', () => {
  for (const [frames, n] of [
    [t94a, 3],
    [t94b, 7],
  ]) {
    const shapes = tg.layoutEdges(frames[0].cells, frames[0].edges, frames[0].levels)
    assert.equal(shapes.length, n)
    for (const s of shapes) {
      assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
      assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
      assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
      assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
    }
  }
})
check('[32.29] 修补单：A 的 s0→s2 x1=171/x2=227、s2→s5 x1=217/x2=194、空格边 s0→s1 x1=151/x2=95 无箭头', () => {
  const byKey = new Map(
    tg.layoutEdges(t94a[0].cells, t94a[0].edges, t94a[0].levels).map((s) => [s.key, s]),
  )
  const r02 = byKey.get('s0->s2')
  assert.equal(r02.x1, 171) // 161 + 10（右孩子出边端口）
  assert.equal(r02.x2, 227) // s2 中心
  const r25 = byKey.get('s2->s5')
  assert.equal(r25.x1, 217) // 227 − 10（左孩子出边端口）
  assert.equal(r25.x2, 194) // s5 中心
  const r01 = byKey.get('s0->s1')
  assert.equal(r01.x1, 151) // 161 − 10
  assert.equal(r01.x2, 95) // s1 空格中心
  assert.equal(r01.nullish, true)
  assert.equal(r01.arrow, null)
})
check('[32.30] 修补单：layoutCells 中心/左上换算 —— A 的 s0 cx=161/left=133/top=56、B 的 s7 cx=62/left=34', () => {
  const a = new Map(tg.layoutCells(t94a[0].cells, t94a[0].levels).map((c) => [c.id, c]))
  assert.equal(a.get('s0').cx, 161)
  assert.equal(a.get('s0').left, 133) // 161 − 28
  assert.equal(a.get('s0').top, 56)
  const b = new Map(tg.layoutCells(t94b[0].cells, t94b[0].levels).map((c) => [c.id, c]))
  assert.equal(b.get('s7').cx, 62)
  assert.equal(b.get('s7').left, 34) // 62 − 28
})

// —— [33] P9a-2：102 二叉树的层序遍历（TreeCanvas 第二个使用者，零渲染器改动）——
import {
  buildFrames as t102Build,
  checkPick as t102Check,
  FIXTURE_A as T102_A,
  FIXTURE_B as T102_B,
} from '../src/demos/tree/level-order/engine.js'

console.log('\n[33] 102 层序遍历')

const t102a = t102Build({ nums: T102_A })
const t102b = t102Build({ nums: T102_B })

check('[33.1] ① A 全对 → 11 帧、分组 [[3],[9,20],[15,7]]、done', () => {
  const f = t102Build({ nums: T102_A, picks: ['s0', 's1', 's2', 's5', 's6'] })
  assert.equal(f.length, 11)
  assert.equal(f[10].done, true)
  assert.deepEqual(f[10].seq, [3, 9, 20, 15, 7])
  assert.deepEqual(f[10].groups, [[3], [9, 20], [15, 7]])
})
check('[33.2] ② B 全对 → 17 帧、分组 [[1],[2,3],[4,5,6,7],[8]]', () => {
  const f = t102Build({ nums: T102_B, picks: ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] })
  assert.equal(f.length, 17)
  assert.equal(f[16].done, true)
  assert.deepEqual(f[16].groups, [[1], [2, 3], [4, 5, 6, 7], [8]])
})
check('[33.3] ③ B 本层没出完点下一层第一个（s3）→ 致命文案点名「本层还剩 1 个」，且不产帧', () => {
  const f = t102Build({ nums: T102_B, picks: ['s0', 's1'] })
  const last = f[f.length - 1]
  assert.deepEqual(last.clickable, ['s2', 's3'])
  const r = t102Check(last, 's3')
  assert.equal(r.ok, false)
  assert.match(r.message, /本层（第 2 层）还剩 1 个/)
  assert.match(r.message, /3（s2）/) // 点名本层剩谁
  assert.equal(t102Build({ nums: T102_B, picks: ['s0', 's1', 's3'] }).length, 5) // s3 静默跳过
})
check('[33.4] ④ A 点本层非队首（s2）→ 「队列先进先出」，且不产帧', () => {
  const f = t102Build({ nums: T102_A, picks: ['s0'] })
  const last = f[f.length - 1]
  assert.deepEqual(last.clickable, ['s1', 's2'])
  const r = t102Check(last, 's2')
  assert.equal(r.ok, false)
  assert.match(r.message, /队列先进先出/)
  assert.match(r.message, /9（s1）/)
  assert.equal(t102Build({ nums: T102_A, picks: ['s0', 's2'] }).length, 3)
})
check('[33.5] ⑤ 层末那一轮 clickable 写死比对：首元素 = 下一层第一个', () => {
  const fa = t102Build({ nums: T102_A, picks: ['s0'] })
  assert.deepEqual(fa[2].clickable, ['s1', 's2']) // s0 = 第 1 层最后一个 → 首元素 s1 = 第 2 层第一个
  const fa3 = t102Build({ nums: T102_A, picks: ['s0', 's1', 's2'] })
  assert.deepEqual(fa3[6].clickable, ['s5', 's6']) // s2 = 第 2 层最后一个 → 首元素 s5 = 第 3 层第一个
  const fb3 = t102Build({ nums: T102_B, picks: ['s0', 's1', 's2'] })
  assert.deepEqual(fb3[6].clickable, ['s3', 's4', 's5', 's6']) // 首元素 s3 = 第 3 层第一个
})
check('[33.6] ⑥ [] → 1 帧 done', () => {
  const f = t102Build({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
})
check('[33.7] ⑦ 真 5 层数组 → 1 帧 done + 「只支持 4 层以内（当前 5 层）」', () => {
  const f = t102Build({ nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.match(f[0].caption, /只支持 4 层以内（当前 5 层）/)
})
check('[33.8] ⑧ 分组长度与 levels 一致（A → 3 组/levels:3；B → 4 组/levels:4）', () => {
  const fa = t102Build({ nums: T102_A, picks: ['s0', 's1', 's2', 's5', 's6'] })
  assert.equal(fa[10].groups.length, 3)
  assert.equal(fa[10].levels, 3)
  const fb = t102Build({ nums: T102_B, picks: ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] })
  assert.equal(fb[16].groups.length, 4)
  assert.equal(fb[16].levels, 4)
})
check('[33.9] ⑨ A、B 的空格列表都等于 []（锁「d = L 不画」）', () => {
  assert.deepEqual(
    t102a[0].cells.filter((c) => c.empty).map((c) => c.id),
    [],
  )
  assert.deepEqual(
    t102b[0].cells.filter((c) => c.empty).map((c) => c.id),
    [],
  )
})
check('[33.10] ⑩ 集成断言：layoutEdges 实算 A、B，端点全部有限；A 4 条边、B 7 条', () => {
  for (const [frames, n] of [
    [t102a, 4],
    [t102b, 7],
  ]) {
    const shapes = tg.layoutEdges(frames[0].cells, frames[0].edges, frames[0].levels)
    assert.equal(shapes.length, n)
    for (const s of shapes) {
      assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
      assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
      assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
      assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
    }
  }
})
check('[33.11] 越界重复：已出队 → 「已经在答案里了」；done 帧 clickable 空 + 「已经走完了」', () => {
  const f = t102Build({ nums: T102_A, picks: ['s0'] })
  const r = t102Check(f[2], 's0')
  assert.equal(r.ok, false)
  assert.match(r.message, /已经在答案里了/)
  const full = t102Build({ nums: T102_A, picks: ['s0', 's1', 's2', 's5', 's6'] })
  assert.deepEqual(full[10].clickable, [])
  assert.match(t102Check(full[10], 's5').message, /已经走完了/)
})
check('[33.12] 逐帧口径：出队高亮在前（f1 已追加 seq=[3]）、层界指针不提前一格（f2 无、f3 落 d2@1）', () => {
  const f = t102Build({ nums: T102_A, picks: ['s0', 's1'] })
  assert.deepEqual(f[1].seq, [3]) // ① 帧 = 出队高亮 + 序列追加
  assert.equal(f[1].marks.s0, 'active')
  assert.equal(f[2].marks.s0, 'ok')
  assert.equal(f[2].edges.find((e) => e.from === 's0' && e.to === 's1').kind, 'path') // ② 帧孩子边转 path
  assert.deepEqual(f[2].pointers, []) // 第 2 层第一个还没出队，层界不该出现
  assert.deepEqual(f[3].pointers, [{ name: 'd2', at: 1 }]) // 9 出队那一刻层界才落下
})

// —— [34] P9a-3：104 二叉树的最大深度（第三种交互：回溯值预测）——
import {
  buildFrames as t104Build,
  checkPick as t104Check,
  FIXTURE_A as T104_A,
  FIXTURE_B as T104_B,
} from '../src/demos/tree/max-depth/engine.js'

console.log('\n[34] 104 最大深度')

const t104a = t104Build({ nums: T104_A })
const t104b = t104Build({ nums: T104_B })
const t104aFull = ['s0', 's1', 'guess-1', 's2', 's5', 'guess-1', 's6', 'guess-1', 'guess-2', 'guess-3']
const t104bFull = ['s0', 's1', 's3', 's7', 'guess-1', 'guess-2', 's4', 'guess-3', 's2', 'guess-4']

check('[34.1] ① A 全对 → 16 帧、答案 3、done', () => {
  const f = t104Build({ nums: T104_A, picks: t104aFull })
  assert.equal(f.length, 16)
  assert.equal(f[15].done, true)
  assert.equal(f[15].depth, 3)
  assert.deepEqual(f[15].answer, [1, 1, 1, 2, 3])
})
check('[34.2] ② B 全对 → 15 帧、答案 4', () => {
  const f = t104Build({ nums: T104_B, picks: t104bFull })
  assert.equal(f.length, 15)
  assert.equal(f[14].done, true)
  assert.equal(f[14].depth, 4)
  assert.deepEqual(f[14].answer, [1, 2, 3, 4])
})
check('[34.3] ③ 只走对路径、预测错 → ok:false「路径没错」且不产帧', () => {
  const g = t104Build({ nums: T104_A, picks: ['s0', 's1'] })
  assert.equal(g.length, 4) // f3 = 9 的 ask 帧
  const r = t104Check(g[3], 'guess-0')
  assert.equal(r.ok, false)
  assert.match(r.message, /路径没错/)
  assert.match(r.message, /9（s1）/)
  assert.equal(t104Build({ nums: T104_A, picks: ['s0', 's1', 'guess-0'] }).length, 4) // 错的 guess 不产帧
})
check('[34.4] ④ B 空格轮点实格 → 点名反馈、不产帧', () => {
  const h = t104Build({ nums: T104_B, picks: ['s0', 's1', 's3', 's7', 'guess-1', 'guess-2'] })
  assert.equal(h.length, 9) // f8 = 3 合并完，轮到空格 s4
  assert.deepEqual(h[8].clickable, ['s4'])
  const r = t104Check(h[8], 's0')
  assert.equal(r.ok, false)
  assert.match(r.message, /空格轮/)
  assert.match(r.message, /s4/)
  assert.equal(t104Build({ nums: T104_B, picks: [...['s0', 's1', 's3', 's7', 'guess-1', 'guess-2'], 's0'] }).length, 9)
})
check('[34.5] ⑤ 空格轮点空格 → 空格事件本身恰 1 帧（f9），跟车的 f10 是父节点 ask', () => {
  const base = ['s0', 's1', 's3', 's7', 'guess-1', 'guess-2']
  const f = t104Build({ nums: T104_B, picks: [...base, 's4'] })
  assert.equal(f.length, 11) // 9 + 空格 1 帧（f9）+ s1 的 ask 跟车 1 帧（f10，计入 s1 的 3 帧之二）
  assert.equal(f[9].marks.s4, 'active')
  assert.match(f[9].caption, /返回 0/)
  assert.ok(f[10].ask !== null) // 跟车的是 s1 的提问
  assert.equal(f[10].ask.cellId, 's1')
})
check('[34.6] ⑥ 点不在 clickable 的格 → 不产帧不报错', () => {
  assert.equal(t104Build({ nums: T104_A, picks: ['s6'] }).length, 1)
  assert.equal(t104Build({ nums: T104_A, picks: ['s0', 's2'] }).length, 2) // s2 在 s0① 时还轮不到
})
check('[34.7] ⑦ [] → 1 帧 done + 答案 0', () => {
  const f = t104Build({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].depth, 0)
})
check('[34.8] ⑧ ask.options 长度与轮转后顺序写死比对（防「永远第一个」）', () => {
  const f0 = t104Build({ nums: T104_A, picks: ['s0', 's1'] })
  assert.deepEqual(
    f0[3].ask.options.map((o) => o.pick),
    ['guess-0', 'guess-1', 'guess-3'],
  )
  const f1 = t104Build({ nums: T104_A, picks: ['s0', 's1', 'guess-1', 's2', 's5'] })
  assert.deepEqual(
    f1[7].ask.options.map((o) => o.pick),
    ['guess-1', 'guess-3', 'guess-0'],
  )
  const f2 = t104Build({ nums: T104_A, picks: ['s0', 's1', 'guess-1', 's2', 's5', 'guess-1', 's6'] })
  assert.deepEqual(
    f2[10].ask.options.map((o) => o.pick),
    ['guess-3', 'guess-0', 'guess-1'],
  )
})
check('[34.9] ⑨ 真 5 层数组 → 1 帧 done + 「只支持 4 层以内」', () => {
  const f = t104Build({ nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.match(f[0].caption, /只支持 4 层以内（当前 5 层）/)
})
check('[34.10] ⑩ 预测正确后 answer 单调不减（A、B 全程）', () => {
  for (const f of [t104Build({ nums: T104_A, picks: t104aFull }), t104Build({ nums: T104_B, picks: t104bFull })]) {
    const ans = f[f.length - 1].answer
    assert.ok(ans.length > 0)
    for (let i = 1; i < ans.length; i += 1) assert.ok(ans[i] >= ans[i - 1], `answer[${i}] < answer[${i - 1}]`)
  }
})
check('[34.11] ⑪ 空格列表：A = []、B = [s2,s4]（锁「第 L 层不画」）', () => {
  assert.deepEqual(
    t104a[0].cells.filter((c) => c.empty).map((c) => c.id),
    [],
  )
  assert.deepEqual(
    t104b[0].cells.filter((c) => c.empty).map((c) => c.id),
    ['s2', 's4'],
  )
})
check('[34.12] 帧结构：cur/back 指针、marks 流转、ask 帧带「不进画面」明写', () => {
  const fa = t104Build({ nums: T104_A, picks: t104aFull })
  assert.deepEqual(fa[1].pointers, [{ name: 'cur', at: 's0' }]) // ① 帧进入
  assert.equal(fa[1].marks.s0, 'active')
  assert.equal(fa[2].marks.s1, 'active') // ① 帧进入 9：active 换成当前主角
  assert.match(fa[3].caption, /第 3 层的空格不进画面/) // 叶两边 ∅ 不画格，caption 明写
  assert.deepEqual(fa[4].pointers, [{ name: 'back', at: 's0' }]) // ③ 帧合并、back 指回父
  assert.equal(fa[4].marks.s1, 'ok')
  assert.deepEqual(fa[4].answer, [1])
  assert.deepEqual(fa[15].pointers, [{ name: 'back', at: null }]) // 根的 back 悬空
  const fb = t104Build({ nums: T104_B, picks: t104bFull })
  assert.equal(fb[9].marks.s4, 'active') // 空格轮：点中即返回 0
  assert.match(fb[9].caption, /返回 0/)
  assert.deepEqual(fb[9].pointers, [
    { name: 'cur', at: 's4' },
    { name: 'back', at: 's1' },
  ])
  assert.deepEqual(fb[12].marks.s2, 'active') // 第二个空格轮（1 的右）
})

// —— [35] P9a-4：98 验证二叉搜索树（range 横条的第一个真正用户）——
import {
  buildFrames as t98Build,
  checkPick as t98Check,
  FIXTURE_A as T98_A,
  FIXTURE_B as T98_B,
  FIXTURE_C as T98_C,
} from '../src/demos/tree/validate-bst/engine.js'

console.log('\n[35] 98 验证二叉搜索树')

const t98a = t98Build({ nums: T98_A })
const t98b = t98Build({ nums: T98_B })
const t98c = t98Build({ nums: T98_C })
const t98aFull = ['s1', 'bound-update', 's0', 'bound-update', 's2', 'bound-update']
const t98bFull = ['s1', 'bound-update', 's0', 'bound-update', 's5', 'bound-update', 's2', 'bound-update', 's6', 'bound-update']
const t98cFull = ['s3', 'bound-update', 's1', 'bound-update', 's4', 'bound-update', 's0', 'bound-update', 's2']

check('[35.1] ① A 全对 → 10 帧、answer === true', () => {
  const f = t98Build({ nums: T98_A, picks: t98aFull })
  assert.equal(f.length, 10)
  assert.equal(f[9].done, true)
  assert.equal(f[9].answer, true)
  assert.deepEqual(f[9].seq, [1, 2, 3])
})
check('[35.2] ② B 全对 → 16 帧、false，违规帧 caption 含节点 3 与界 5', () => {
  const f = t98Build({ nums: T98_B, picks: t98bFull })
  assert.equal(f.length, 16)
  assert.equal(f[15].answer, false)
  assert.match(f[8].caption, /3（s5）/) // 违规节点
  assert.match(f[8].caption, /5（s0）/) // 传下界的祖先
  assert.match(f[8].caption, /下界/)
})
check('[35.3] ③ C 全对 → 14 帧、false，违规帧 caption 含节点 7 与界 5', () => {
  const f = t98Build({ nums: T98_C, picks: t98cFull })
  assert.equal(f.length, 14)
  assert.equal(f[13].answer, false)
  assert.match(f[8].caption, /7（s4）/)
  assert.match(f[8].caption, /越过祖先 5（s0）传下来的上界/)
})
check('[35.4] ④ C 点 bound-inherit → 后续必判成 true（父子比较的漏网，sticky）', () => {
  const at7 = t98Build({
    nums: T98_C,
    picks: ['s3', 'bound-update', 's1', 'bound-update', 's4', 'bound-inherit', 's0', 'bound-update', 's2'],
  })
  assert.equal(at7.length, 14)
  assert.equal(at7[13].answer, true) // 7 只和父节点 4 比 → 漏网
  const fromStart = t98Build({
    nums: T98_C,
    picks: ['s3', 'bound-inherit', 's1', 'bound-update', 's4', 'bound-update', 's0', 'bound-update', 's2'],
  })
  assert.equal(fromStart[13].answer, true) // sticky：第一个 inherit 之后全部退化为父子比较
})
check('[35.5] ⑤ C 空格 s2 轮点实格 → 点名反馈、不产帧', () => {
  const base = ['s3', 'bound-update', 's1', 'bound-update', 's4', 'bound-update', 's0', 'bound-update']
  const h = t98Build({ nums: T98_C, picks: base })
  assert.equal(h.length, 13) // f12 = 5 判完，轮到空格 s2
  assert.deepEqual(h[12].clickable, ['s2'])
  const r = t98Check(h[12], 's0')
  assert.equal(r.ok, false)
  assert.match(r.message, /空格轮/)
  assert.match(r.message, /s2/)
  assert.equal(t98Build({ nums: T98_C, picks: [...base, 's0'] }).length, 13)
})
check('[35.6] ⑥ [] → 1 帧 done + true（空树合法）', () => {
  const f = t98Build({ nums: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].answer, true)
})
check('[35.7] ⑦ 中序严格递增 ⟺ 合法（A 递增且 true；B、C 各一处不递增且 false）', () => {
  const fa = t98Build({ nums: T98_A, picks: t98aFull })
  const fb = t98Build({ nums: T98_B, picks: t98bFull })
  const fc = t98Build({ nums: T98_C, picks: t98cFull })
  const drops = (f) => {
    let n = 0
    for (let i = 1; i < f.seq.length; i += 1) if (f.seq[i] <= f.seq[i - 1]) n += 1
    return n
  }
  assert.equal(drops(fa[9]), 0)
  assert.equal(fa[9].answer, true)
  assert.equal(drops(fb[15]), 1) // 1,5,3,4,6 的 5→3
  assert.equal(fb[15].answer, false)
  assert.equal(drops(fc[13]), 1) // 3,4,7,5 的 7→5
  assert.equal(fc[13].answer, false)
})
check('[35.8] ⑧ range 的 lo/hi 写死比对（三组各一次：格 id，不是坐标）', () => {
  const fa = t98Build({ nums: T98_A, picks: ['s1', 'bound-update'] })
  assert.deepEqual(fa[2].range, { lo: 's1', hi: 's0' }) // 1 的区间 (−∞, 2)：−∞ → 最左格 s1
  const fb = t98Build({ nums: T98_B, picks: ['s1', 'bound-update', 's0', 'bound-update', 's5', 'bound-update'] })
  assert.deepEqual(fb[8].range, { lo: 's0', hi: 's2' }) // 3 的区间 (5, 4)：空区间也照画
  const fc = t98Build({ nums: T98_C, picks: ['s3', 'bound-update', 's1', 'bound-update', 's4', 'bound-update'] })
  assert.deepEqual(fc[8].range, { lo: 's1', hi: 's0' }) // 7 的区间 (4, 5)：题眼帧
})
check('[35.9] ⑨ 点不在 clickable 的格 / 时机不对的 bound → 不产帧不报错', () => {
  assert.equal(t98Build({ nums: T98_A, picks: ['s2'] }).length, 1)
  assert.equal(t98Build({ nums: T98_A, picks: ['s1', 's2'] }).length, 2) // ask 阶段点格 = 跳过
  assert.equal(t98Build({ nums: T98_A, picks: ['s1', 'bound-update', 'bound-inherit'] }).length, 4) // 格子决策阶段答 bound = 跳过
})
check('[35.10] ⑩ 真 5 层数组 → 1 帧 done + 「只支持 4 层以内」', () => {
  const f = t98Build({ nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.match(f[0].caption, /只支持 4 层以内（当前 5 层）/)
})
check('[35.11] ⑪ 空格列表：A = []、B = []、C = [s2]（锁「第 L 层不画」）', () => {
  for (const [frames, want] of [
    [t98a, []],
    [t98b, []],
    [t98c, ['s2']],
  ]) {
    assert.deepEqual(
      frames[0].cells.filter((c) => c.empty).map((c) => c.id),
      want,
    )
  }
})
check('[35.12] ⑫ 集成断言：layoutEdges 实算三组，端点全有限；A 2 条、B 4 条、C 3 条', () => {
  for (const [frames, n] of [
    [t98a, 2],
    [t98b, 4],
    [t98c, 3],
  ]) {
    const shapes = tg.layoutEdges(frames[0].cells, frames[0].edges, frames[0].levels)
    assert.equal(shapes.length, n)
    for (const s of shapes) {
      assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
      assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
      assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
      assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
    }
  }
})
check('[35.13] ask 选项轮转（照 reverse-list 的 makeAsk(round)）：C 的前三问顺序写死', () => {
  const f = t98Build({ nums: T98_C, picks: ['s3', 'bound-update', 's1', 'bound-update', 's4'] })
  assert.deepEqual(
    f[1].ask.options.map((o) => o.pick),
    ['bound-update', 'bound-inherit'],
  )
  assert.deepEqual(
    f[4].ask.options.map((o) => o.pick),
    ['bound-inherit', 'bound-update'],
  )
  assert.deepEqual(
    f[7].ask.options.map((o) => o.pick),
    ['bound-update', 'bound-inherit'],
  )
})
check('[35.14] 路径全对但边界选错 → ok:false，文案点名「退化成父子比较、C 组就会漏」', () => {
  const f = t98Build({ nums: T98_C, picks: ['s3'] })
  const r = t98Check(f[1], 'bound-inherit')
  assert.equal(r.ok, false)
  assert.match(r.message, /路径没错/)
  assert.match(r.message, /退化成父子比较/)
  assert.match(r.message, /C 组就会漏/)
})
check('[35.15] 修补单：idToIdx 往返 —— slotId ∘ idxToDK ∘ idToIdx 对 s0…s14 回到自身', () => {
  assert.equal(tg.idToIdx('s7'), 7)
  assert.equal(tg.idToIdx('s14'), 14)
  for (let i = 0; i <= 14; i += 1) {
    const id = `s${i}`
    const { d, k } = tg.idxToDK(tg.idToIdx(id))
    assert.equal(tg.slotId(d, k), id)
  }
})
check('[35.16] 修补单：rangeBarRect 三组坐标有限且有序（直接调组件同款函数，不再重写算式）', () => {
  for (const [r, L] of [
    [{ lo: 's0', hi: 's2' }, 2],
    [{ lo: 's2', hi: 's6' }, 3],
    [{ lo: 's0', hi: 's2' }, 3],
  ]) {
    const g = tg.rangeBarRect(r, L)
    assert.ok(Number.isFinite(g.x1) && Number.isFinite(g.x2), 'x 必须是有限数')
    assert.ok(g.x1 < g.x2, 'x1 必须小于 x2')
  }
  assert.equal(tg.rangeBarRect(null, 3), null)
})

// —— [36] P9b-1：215 数组中第 K 大的元素（TreeCanvas 第一次画堆）——
import {
  buildFrames as t215Build,
  checkPick as t215Check,
  FIXTURE_A as T215_A,
  FIXTURE_B as T215_B,
} from '../src/demos/heap/kth-largest/engine.js'

console.log('\n[36] 215 第 K 大')

const t215aFull = ['op-push', 'op-push', 'op-push', 'op-replace', 'op-discard', 'op-replace']
const t215bFull = ['op-push', 'op-push', 'op-push', 'op-push', 'op-discard', 'op-replace', 'op-discard']

check('[36.1] ① A 全对 → 13 帧、答案 3、done', () => {
  const f = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  assert.equal(f.length, 13)
  assert.equal(f[12].done, true)
  assert.equal(f[12].answer, 3)
})
check('[36.2] ② B 全对 → 15 帧、答案 6', () => {
  const f = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  assert.equal(f.length, 15)
  assert.equal(f[14].done, true)
  assert.equal(f[14].answer, 6)
})
check('[36.3] ③ 堆规模恒 ≤ k（A ≤3、B ≤4，锁不变式）', () => {
  const fa = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  const fb = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  for (const fr of fa) assert.ok(fr.heap.length <= T215_A.k, `A 堆超规模：${fr.heap.length}`)
  for (const fr of fb) assert.ok(fr.heap.length <= T215_B.k, `B 堆超规模：${fr.heap.length}`)
})
check('[36.4] ④ A 第 5 个元素（0）该丢弃，选 op-replace → ok:false「会把答案挤掉」', () => {
  const f = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: ['op-push', 'op-push', 'op-push', 'op-replace'] })
  assert.equal(f.length, 9) // f8 = 元素 0 的决策帧（堆 [2,3,5] 顶 2）
  const r = t215Check(f[8], 'op-replace')
  assert.equal(r.ok, false)
  assert.match(r.message, /0 比堆顶 2 小/)
  assert.match(r.message, /会把答案挤掉/)
  assert.equal(t215Build({ nums: T215_A.nums, k: T215_A.k, picks: [...['op-push', 'op-push', 'op-push', 'op-replace'], 'op-replace'] }).length, 9) // 不产帧
})
check('[36.5] ⑤ A 第 4 个元素（5）该换顶，选 op-discard → ok:false「丢掉就漏了」', () => {
  const f = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: ['op-push', 'op-push', 'op-push'] })
  assert.equal(f.length, 7) // f6 = 元素 5 的决策帧（堆 [1,3,2] 顶 1）
  const r = t215Check(f[6], 'op-discard')
  assert.equal(r.ok, false)
  assert.match(r.message, /5 比堆顶 1 大/)
  assert.match(r.message, /丢掉就漏了/)
})
check('[36.6] ⑥ 堆没满时选 op-replace / op-discard → ok:false「先装满」', () => {
  const f = t215Build({ nums: T215_A.nums, k: T215_A.k })
  assert.equal(f.length, 1) // f0 = 第一问，堆 0/3
  assert.match(t215Check(f[0], 'op-replace').message, /先装满/)
  assert.match(t215Check(f[0], 'op-discard').message, /先装满/)
})
check('[36.7] ⑦ [] → 1 帧 done + 答案 null', () => {
  const f = t215Build({ nums: [], k: 3 })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].answer, null)
})
check('[36.8] ⑧ k > 数组长度 → 1 帧 done + null', () => {
  const f = t215Build({ nums: [1, 2], k: 5 })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].answer, null)
})
check('[36.9] ⑨ ask 三项顺序按轮转写死比对（防「永远同一位置」）', () => {
  const f = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: ['op-push', 'op-push'] })
  assert.deepEqual(
    f[0].ask.options.map((o) => o.pick),
    ['op-push', 'op-replace', 'op-discard'],
  )
  assert.deepEqual(
    f[2].ask.options.map((o) => o.pick),
    ['op-replace', 'op-discard', 'op-push'],
  )
  assert.deepEqual(
    f[4].ask.options.map((o) => o.pick),
    ['op-discard', 'op-push', 'op-replace'],
  )
})
check('[36.10] ⑩ 最终堆顶 === 答案（A 3、B 6），且堆规模 === k', () => {
  const fa = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  assert.equal(fa[12].heap[0], 3)
  assert.equal(fa[12].heap.length, T215_A.k)
  const fb = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  assert.equal(fb[14].heap[0], 6)
  assert.equal(fb[14].heap.length, T215_B.k)
})
check('[36.11] ⑪ 父子关系：A 终局 2 条边、B 3 条，每条 to 都是 from 的 2i+1/2i+2', () => {
  const fa = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  const fb = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  for (const [f, n] of [
    [fa, 2],
    [fb, 3],
  ]) {
    assert.equal(f[f.length - 1].edges.length, n)
    for (const e of f[f.length - 1].edges) {
      const child = tg.idToIdx(e.to)
      const parent = tg.idToIdx(e.from)
      assert.ok(child === parent * 2 + 1 || child === parent * 2 + 2, `${e.from}->${e.to} 不是父子`)
    }
  }
})
check('[36.12] ⑫ 集成断言：layoutEdges 实算 A/B 终局堆，端点全部有限', () => {
  const fa = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  const fb = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  for (const [f, n] of [
    [fa, 2],
    [fb, 3],
  ]) {
    const last = f[f.length - 1]
    const shapes = tg.layoutEdges(last.cells, last.edges, last.levels)
    assert.equal(shapes.length, n)
    for (const s of shapes) {
      assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
      assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
      assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
      assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
    }
  }
})
check('[36.13] 任务书轨迹写死：A [1,3,2]→[2,3,5]→[3,5,4]；B [5,7,8,9]→[6,7,8,9]', () => {
  const fa = t215Build({ nums: T215_A.nums, k: T215_A.k, picks: t215aFull })
  assert.deepEqual(fa[5].heap, [1, 3, 2]) // 入 1 后
  assert.deepEqual(fa[7].heap, [2, 3, 5]) // 换顶 5 后
  assert.deepEqual(fa[9].heap, [2, 3, 5]) // 丢弃 0 后（不动）
  assert.deepEqual(fa[11].heap, [3, 5, 4]) // 换顶 4 后
  const fb = t215Build({ nums: T215_B.nums, k: T215_B.k, picks: t215bFull })
  assert.deepEqual(fb[7].heap, [5, 7, 8, 9]) // 入满 4 个
  assert.deepEqual(fb[11].heap, [6, 7, 8, 9]) // 换顶 6 后
})

// —— [37] P9b-2：347 前 K 个高频元素（HashCanvas + TreeCanvas 双画布联动）——
import {
  buildFrames as t347Build,
  checkPick as t347Check,
  FIXTURE_A as T347_A,
  FIXTURE_B as T347_B,
} from '../src/demos/heap/top-k-frequent/engine.js'

console.log('\n[37] 347 前 K 高频')

const t347aFull = ['op-push', 'op-push', 'op-push', 'op-discard', 'op-replace']
const t347bFull = ['op-push', 'op-push', 'op-replace']

check('[37.1] ① A 全对 → 12 帧、答案 [5,1,2]、done', () => {
  const f = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  assert.equal(f.length, 12)
  assert.equal(f[11].done, true)
  assert.deepEqual(f[11].answer, [5, 1, 2])
})
check('[37.2] ② B 全对 → 8 帧、答案 [3,1]', () => {
  const f = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  assert.equal(f.length, 8)
  assert.equal(f[7].done, true)
  assert.deepEqual(f[7].answer, [3, 1])
})
check('[37.3] ③ 频率表正确：A 1→3 2→2 3→1 4→1 5→5；B 1→2 2→1 3→3', () => {
  const freqMap = (frame) => {
    const m = {}
    for (const chain of frame.hash.buckets) for (const item of chain) m[item.key] = item.value
    return m
  }
  assert.deepEqual(freqMap(t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })[1]), {
    1: '3',
    2: '2',
    3: '1',
    4: '1',
    5: '5',
  })
  assert.deepEqual(freqMap(t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })[1]), {
    1: '2',
    2: '1',
    3: '3',
  })
})
check('[37.4] ④ buckets 结构合法：key/value 全字符串、capacity = 不同值个数（A=5、B=3）', () => {
  for (const [data, cap] of [
    [T347_A, 5],
    [T347_B, 3],
  ]) {
    const f = t347Build({ nums: data.nums, k: data.k })
    assert.equal(f[1].hash.capacity, cap)
    assert.equal(f[1].hash.buckets.length, cap)
    const items = f[1].hash.buckets.flat()
    assert.equal(items.length, cap) // 每个不同值恰一项
    for (const it of items) {
      assert.equal(typeof it.key, 'string')
      assert.equal(typeof it.value, 'string')
    }
  }
})
check('[37.5] ⑤ 该丢弃（A 的 4）却选 op-replace → ok:false「换进来会把堆顶 3 挤掉」', () => {
  const f = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: ['op-push', 'op-push', 'op-push'] })
  assert.equal(f.length, 8) // f7 = 值 4 的决策帧（堆 [3,1,2] 顶 3 频率 1）
  const r = t347Check(f[7], 'op-replace')
  assert.equal(r.ok, false)
  assert.match(r.message, /4 只出现 1 次/)
  assert.match(r.message, /会把堆顶 3 挤掉/) // 书例句的「5」不在堆中：被挤的是堆顶 3，断言锁实际值
})
check('[37.6] ⑥ 该换顶（A 的 5）却选 op-discard → ok:false「丢掉就漏了」', () => {
  const f = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: ['op-push', 'op-push', 'op-push', 'op-discard'] })
  assert.equal(f.length, 10) // f9 = 值 5 的决策帧（堆 [3,1,2] 顶 3 频率 1）
  const r = t347Check(f[9], 'op-discard')
  assert.equal(r.ok, false)
  assert.match(r.message, /5 出现 5 次/)
  assert.match(r.message, /比堆顶 3 的 1 次多/)
  assert.match(r.message, /丢掉就漏了/)
})
check('[37.7] ⑦ 堆规模恒 ≤ k（A ≤3、B ≤2）', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  const fb = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  for (const fr of fa) assert.ok(fr.heap.length <= T347_A.k, `A 堆超规模：${fr.heap.length}`)
  for (const fr of fb) assert.ok(fr.heap.length <= T347_B.k, `B 堆超规模：${fr.heap.length}`)
})
check('[37.8] ⑧ ask 三项顺序按轮转写死比对（防「永远同一位置」）', () => {
  const f1 = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: ['op-push'] })
  assert.deepEqual(
    f1[1].ask.options.map((o) => o.pick),
    ['op-push', 'op-replace', 'op-discard'],
  )
  assert.deepEqual(
    f1[3].ask.options.map((o) => o.pick),
    ['op-replace', 'op-discard', 'op-push'],
  )
  const f2 = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: ['op-push', 'op-push'] })
  assert.deepEqual(
    f2[5].ask.options.map((o) => o.pick),
    ['op-discard', 'op-push', 'op-replace'],
  )
})
check('[37.9] ⑨ 最终堆顶的频率 = 第 k 高的频率（A 顶 2(2 次)、B 顶 1(2 次)）', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  assert.equal(fa[11].heap[0].v, 2)
  assert.equal(fa[11].heap[0].f, 2) // 按频率小顶堆：{1(3),2(2),5(5)} 顶必是频率最小的 2 —— 书表「A 顶频率 3」系笔误
  const fb = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  assert.equal(fb[7].heap[0].v, 1)
  assert.equal(fb[7].heap[0].f, 2)
})
check('[37.10] ⑩ 堆的父子边数：A 终局恰 2 条、B 恰 1 条', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  const fb = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  assert.equal(fa[11].edges.length, 2)
  assert.equal(fb[7].edges.length, 1)
})
check('[37.11] ⑪ [] → 1 帧 done + []；k > 不同值个数 → 全部值都进答案', () => {
  const f = t347Build({ nums: [], k: 3 })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.deepEqual(f[0].answer, [])
  const g = t347Build({ nums: [1, 1, 2], k: 5, picks: ['op-push', 'op-push'] })
  assert.equal(g[g.length - 1].done, true)
  assert.deepEqual(g[g.length - 1].answer, [1, 2]) // 1(2 次)、2(1 次) 全进
})
check('[37.12] ⑫ 集成断言：layoutEdges 实算 A/B 终局堆边全有限；range 恒 null（本题不用横条）', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  const fb = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  for (const [f, n] of [
    [fa, 2],
    [fb, 1],
  ]) {
    const last = f[f.length - 1]
    const shapes = tg.layoutEdges(last.cells, last.edges, last.levels)
    assert.equal(shapes.length, n)
    for (const s of shapes) {
      assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
      assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
      assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
      assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
    }
  }
  for (const f of [fa, fb]) {
    for (const fr of f) assert.ok(fr.range === undefined || fr.range === null, '本题不该出现 range')
  }
})
check('[37.13] 轨迹写死：A [1]→[2,1]→[3,1,2]→丢弃不动→[2,1,5]；B [2,1]→[1,3]', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  const vals = (fr) => fr.heap.map((h) => h.v)
  assert.deepEqual(vals(fa[2]), [1])
  assert.deepEqual(vals(fa[4]), [2, 1])
  assert.deepEqual(vals(fa[6]), [3, 1, 2])
  assert.deepEqual(vals(fa[8]), [3, 1, 2]) // 丢弃 4：不动
  assert.deepEqual(vals(fa[10]), [2, 1, 5]) // 换顶 5 后（按频率小顶堆的数组序）
  const fb = t347Build({ nums: T347_B.nums, k: T347_B.k, picks: t347bFull })
  assert.deepEqual(vals(fb[4]), [2, 1])
  assert.deepEqual(vals(fb[6]), [1, 3])
})
check('[37.14] 左表全程在场：f0 空桶、f1 起满员（统计 1 帧给全，不让用户数）', () => {
  const fa = t347Build({ nums: T347_A.nums, k: T347_A.k, picks: t347aFull })
  for (const fr of fa) assert.ok(fr.hash && fr.hash.buckets.length === 5)
  assert.equal(fa[0].hash.buckets.flat().length, 0) // 初始：还没数
  assert.equal(fa[1].hash.buckets.flat().length, 5) // 统计帧：一次给全
})

// —— [38] P9b-3：295 数据流的中位数（双堆，noScale 的第一个真正用户）——
import {
  buildFrames as t295Build,
  checkPick as t295Check,
  FIXTURE_A as T295_A,
  FIXTURE_B as T295_B,
} from '../src/demos/heap/median-finder/engine.js'

console.log('\n[38] 295 双堆中位数')

const t295aFull = ['op-big', 'op-small', 'op-small', 'op-small', 'op-small']
const t295bFull = ['op-big', 'op-big', 'op-small', 'op-big', 'op-small', 'op-big']

check('[38.1] ① A 全对 → 11 帧；5 个结果帧 median 依次 1,2,2,2.5,3；末帧 done', () => {
  const f = t295Build({ stream: T295_A.stream, picks: t295aFull })
  assert.equal(f.length, 11)
  assert.deepEqual(
    [f[1].median, f[3].median, f[5].median, f[7].median, f[9].median],
    [1, 2, 2, 2.5, 3],
  )
  assert.equal(f[10].done, true)
})
check('[38.2] ② B 全对 → 13 帧；6 个结果帧 median 依次 5,3.5,5,3.5,4,3.5', () => {
  const f = t295Build({ stream: T295_B.stream, picks: t295bFull })
  assert.equal(f.length, 13)
  assert.deepEqual(
    [f[1].median, f[3].median, f[5].median, f[7].median, f[9].median, f[11].median],
    [5, 3.5, 5, 3.5, 4, 3.5],
  )
  assert.equal(f[12].done, true)
})
check('[38.3] ③ 不变量：全程 |大顶| − |小顶| ∈ {0,1}（A、B 每帧）', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  for (const fr of [...fa, ...fb]) {
    const d = fr.maxHeap.length - fr.minHeap.length
    assert.ok(d === 0 || d === 1, `不变量破坏：|大顶|−|小顶| = ${d}`)
  }
})
check('[38.4] ④ 中位数公式：等长取平均（A 第 2 步 2、第 4 步 2.5）、不等取大顶顶（A 第 1 步 1）', () => {
  const f = t295Build({ stream: T295_A.stream, picks: t295aFull })
  assert.equal(f[3].maxHeap.length, f[3].minHeap.length) // 等长
  assert.equal(f[3].median, (f[3].maxHeap[0] + f[3].minHeap[0]) / 2)
  assert.equal(f[3].median, 2)
  assert.equal(f[7].maxHeap.length, f[7].minHeap.length)
  assert.equal(f[7].median, 2.5)
  assert.equal(f[1].maxHeap.length - f[1].minHeap.length, 1) // 不等
  assert.equal(f[1].median, f[1].maxHeap[0])
  assert.equal(f[1].median, 1)
})
check('[38.5] ⑤ 该进大顶（B 第 2 步 2）却选 op-small → ok:false，点名「2 ≤ 大顶顶 5」', () => {
  const f = t295Build({ stream: T295_B.stream, picks: ['op-big'] })
  assert.equal(f.length, 3) // f2 = 元素 2 的决策帧（大顶 [5] 顶 5）
  const r = t295Check(f[2], 'op-small')
  assert.equal(r.ok, false)
  assert.match(r.message, /2 ≤ 大顶顶 5/)
})
check('[38.6] ⑥ 该进小顶（A 第 2 步 3）却选 op-big → ok:false，点名「3 > 大顶顶 1」', () => {
  const f = t295Build({ stream: T295_A.stream, picks: ['op-big'] })
  assert.equal(f.length, 3) // f2 = 元素 3 的决策帧（大顶 [1] 顶 1）
  const r = t295Check(f[2], 'op-big')
  assert.equal(r.ok, false)
  assert.match(r.message, /3 > 大顶顶 1/)
})
check('[38.7] ⑦ 搬移轮次写死：A 第 3/5 步搬 2/3（小顶→大顶）；B 第 2–6 步各搬一次', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  assert.equal(fa[1].moved, null)
  assert.equal(fa[3].moved, null)
  assert.deepEqual(fa[5].moved, { v: 2, from: 'min' })
  assert.equal(fa[7].moved, null)
  assert.deepEqual(fa[9].moved, { v: 3, from: 'min' })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  assert.equal(fb[1].moved, null)
  assert.deepEqual(fb[3].moved, { v: 5, from: 'max' })
  assert.deepEqual(fb[5].moved, { v: 5, from: 'min' })
  assert.deepEqual(fb[7].moved, { v: 5, from: 'max' })
  assert.deepEqual(fb[9].moved, { v: 4, from: 'min' })
  assert.deepEqual(fb[11].moved, { v: 4, from: 'max' })
})
check('[38.8] ⑧ ask 顺序写死：第 1 轮 [op-big,op-small]、第 2 轮 [op-small,op-big]、第 3 轮 [op-big,op-small]', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: ['op-big', 'op-small'] })
  assert.deepEqual(
    fa[0].ask.options.map((o) => o.pick),
    ['op-big', 'op-small'],
  )
  assert.deepEqual(
    fa[2].ask.options.map((o) => o.pick),
    ['op-small', 'op-big'],
  )
  assert.deepEqual(
    fa[4].ask.options.map((o) => o.pick),
    ['op-big', 'op-small'],
  )
  const fb = t295Build({ stream: T295_B.stream, picks: ['op-big', 'op-big'] })
  assert.deepEqual(
    fb[0].ask.options.map((o) => o.pick),
    ['op-big', 'op-small'],
  )
  assert.deepEqual(
    fb[2].ask.options.map((o) => o.pick),
    ['op-small', 'op-big'],
  )
  assert.deepEqual(
    fb[4].ask.options.map((o) => o.pick),
    ['op-big', 'op-small'],
  )
})
check('[38.9] ⑨ 边数：3 节点的树各 2 条（A 末帧大顶、B 末帧小顶）', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  assert.equal(fa[10].maxTree.cells.length, 3)
  assert.equal(fa[10].maxTree.edges.length, 2)
  assert.equal(fb[12].minTree.cells.length, 3)
  assert.equal(fb[12].minTree.edges.length, 2)
})
check('[38.10] ⑩ noScale 纯函数层：treeMaxWidth(2,{noScale:true})=190、treeWidth(2)=190、默认 304', () => {
  assert.equal(tg.treeMaxWidth(2, { noScale: true }), 190)
  assert.equal(tg.treeWidth(2), 190)
  assert.equal(tg.treeMaxWidth(2), 304)
})
check('[38.11] ⑪ 空流 → 1 帧 done + 中位数 null', () => {
  const f = t295Build({ stream: [] })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].median, null)
})
check('[38.12] ⑫ 集成断言：layoutEdges 实算两棵树，端点全有限；range 恒 null', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  for (const f of [fa, fb]) {
    for (const fr of f) {
      for (const tree of [fr.maxTree, fr.minTree]) {
        const shapes = tg.layoutEdges(tree.cells, tree.edges, tree.levels)
        for (const s of shapes) {
          assert.ok(Number.isFinite(s.x1), `${s.key} x1=NaN`)
          assert.ok(Number.isFinite(s.x2), `${s.key} x2=NaN`)
          assert.ok(Number.isFinite(s.y1), `${s.key} y1=NaN`)
          assert.ok(Number.isFinite(s.y2), `${s.key} y2=NaN`)
        }
      }
      assert.ok(fr.range === undefined || fr.range === null, '本题不该出现 range')
    }
  }
})
check('[38.13] 脚本轨迹逐行核对：两表的堆列（层序堆数组）与施工后实现一致', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  const rowsA = [
    [1, 3, 5, 7, 9],
    [
      [[1], []],
      [[1], [3]],
      [[2, 1], [3]],
      [[2, 1], [3, 5]],
      [[3, 1, 2], [4, 5]],
    ],
  ]
  rowsA[0].forEach((fi, i) => {
    assert.deepEqual(fa[fi].maxHeap, rowsA[1][i][0], `A f${fi} 大顶`)
    assert.deepEqual(fa[fi].minHeap, rowsA[1][i][1], `A f${fi} 小顶`)
  })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  const rowsB = [
    [1, 3, 5, 7, 9, 11],
    [
      [[5], []],
      [[2], [5]],
      [[5, 2], [6]],
      [[2, 1], [5, 6]],
      [[4, 1, 2], [5, 6]],
      [[3, 1, 2], [4, 6, 5]],
    ],
  ]
  rowsB[0].forEach((fi, i) => {
    assert.deepEqual(fb[fi].maxHeap, rowsB[1][i][0], `B f${fi} 大顶`)
    assert.deepEqual(fb[fi].minHeap, rowsB[1][i][1], `B f${fi} 小顶`)
  })
})
check('[38.14] 两堆 levels 恒 ≤ 2（各 ≤3 节点，锁「别写成 L=3」；noScale 下 190×2+16=396 ≤ 900）', () => {
  const fa = t295Build({ stream: T295_A.stream, picks: t295aFull })
  const fb = t295Build({ stream: T295_B.stream, picks: t295bFull })
  for (const fr of [...fa, ...fb]) {
    assert.ok(fr.maxTree.levels <= 2, `大顶 levels=${fr.maxTree.levels}`)
    assert.ok(fr.minTree.levels <= 2, `小顶 levels=${fr.minTree.levels}`)
  }
})

// —— [39] P10-1-200：网格 DFS 岛屿数量 + GridCanvas 几何 ——
const {
  buildFrames: t200Build,
  checkPick: t200Check,
  FIXTURE_A: T200_A,
  FIXTURE_B: T200_B,
} = await import('../src/demos/graph/num-islands/engine.js')
const tgrid = await import('../src/core/grid-geom.js')

console.log('\n[39] 200 岛屿数量')

const t200aFull = ['right', 'down', 'right', 'down', 'left']
const t200bFull = ['right', 'right', 'down', 'down', 'left', 'left', 'down', 'down', 'down', 'down', 'left', 'left']

check('[39.1] ① A 全对 → 11 帧；末帧 done、2 岛、访问 7', () => {
  const f = t200Build({ data: T200_A, picks: t200aFull })
  assert.equal(f.length, 11)
  assert.equal(f[10].done, true)
  assert.equal(f[10].count, 2)
  assert.equal(f[10].visited, 7)
})
check('[39.2] ② B 全对 → 25 帧；末帧 done、3 岛、访问 15', () => {
  const f = t200Build({ data: T200_B, picks: t200bFull })
  assert.equal(f.length, 25)
  assert.equal(f[24].done, true)
  assert.equal(f[24].count, 3)
  assert.equal(f[24].visited, 15)
})
check('[39.3] ③ A/B 帧数公式及决策帧、结果帧位置', () => {
  for (const [data, picks] of [[T200_A, t200aFull], [T200_B, t200bFull]]) {
    const f = t200Build({ data, picks })
    assert.equal(f.length, 1 + 2 * picks.length)
    f.forEach((fr, i) => {
      if (i === f.length - 1) assert.equal(fr.done, true)
      else if (i % 2 === 0) assert.ok(fr.ask !== null)
      else assert.ok(fr.ask === null && !fr.done)
    })
  }
})
check('[39.4] ④ A/B 正确方向序列与选项顺序固定为上右下左', () => {
  const expected = {
    A: ['right', 'down', 'right', 'down', 'left'],
    B: ['right', 'right', 'down', 'down', 'left', 'left', 'down', 'down', 'down', 'down', 'left', 'left'],
  }
  for (const [name, data, picks] of [['A', T200_A, t200aFull], ['B', T200_B, t200bFull]]) {
    const f = t200Build({ data, picks })
    assert.deepEqual(f.filter((fr) => fr.ask).map((fr) => fr.ask.correct), expected[name])
    for (const fr of f.filter((item) => item.ask)) {
      assert.deepEqual(fr.ask.options.map((option) => option.pick), ['up', 'right', 'down', 'left'])
    }
  }
})
check('[39.5] ⑤ 岛数等于累计 seeded 数；每次种岛前栈已空', () => {
  for (const [data, picks] of [[T200_A, t200aFull], [T200_B, t200bFull]]) {
    const f = t200Build({ data, picks })
    let seededTotal = 0
    for (let i = 0; i < f.length; i += 1) {
      const fr = f[i]
      seededTotal += fr.seeded.length
      assert.equal(fr.count, seededTotal)
      if (!fr.seeded.length) continue

      const oldStack = [...(f[i - 1]?.stack ?? [])]
      let poppedAt = 0
      while (oldStack.length) assert.equal(fr.popped[poppedAt++], oldStack.pop())
      for (const id of fr.seeded.slice(0, -1)) assert.equal(fr.popped[poppedAt++], id)
      const lastSeed = fr.seeded.at(-1)
      if (fr.stack.at(-1) !== lastSeed) assert.equal(fr.popped[poppedAt], lastSeed)
    }
  }
})
check('[39.6] ⑥ 每帧访问序号连续且数量等于 visited', () => {
  for (const [data, picks] of [[T200_A, t200aFull], [T200_B, t200bFull]]) {
    for (const fr of t200Build({ data, picks })) {
      const orders = fr.cells.map((cell) => cell.order).filter((order) => order !== null).sort((a, b) => a - b)
      assert.equal(orders.length, fr.visited)
      assert.deepEqual(orders, Array.from({ length: fr.visited }, (_, i) => i + 1))
    }
  }
})
check('[39.7] ⑦ A f8 回溯两格后站在 g1-1，栈深 3', () => {
  const f = t200Build({ data: T200_A, picks: t200aFull })[8]
  assert.deepEqual(f.popped, ['g2-2', 'g1-2'])
  assert.equal(f.stack.at(-1), 'g1-1')
  assert.equal(f.stack.length, 3)
})
check('[39.8] ⑧ A f10 退栈与单格岛只计一次', () => {
  const f = t200Build({ data: T200_A, picks: t200aFull })[10]
  assert.deepEqual(f.popped, ['g1-0', 'g1-1', 'g0-1', 'g0-0', 'g3-4'])
  assert.deepEqual(f.seeded, ['g3-4'])
  assert.equal(f.count, 2)
})
check('[39.9] ⑨ B f16 跨岛：退栈 10 格、种两岛、栈顶 g2-4', () => {
  const f = t200Build({ data: T200_B, picks: t200bFull })[16]
  assert.equal(f.popped.length, 10)
  assert.deepEqual(f.seeded, ['g0-4', 'g2-4'])
  assert.equal(f.count, 3)
  assert.equal(f.visited, 11)
  assert.equal(f.stack.at(-1), 'g2-4')
})
check('[39.10] ⑩ 合法但顺序靠后会点名坐标与优先方向；越界点名原因', () => {
  const f0 = t200Build({ data: T200_A })[0]
  const late = t200Check(f0, 'down')
  assert.equal(late.ok, false)
  assert.match(late.message, /\(1,0\)/)
  assert.match(late.message, /右/)
  assert.match(t200Check(f0, 'up').message, /越界/)
  assert.match(t200Check(f0, 'left').message, /越界/)
})
check('[39.11] ⑪ 水格、已访问格与正确选择反馈准确', () => {
  const f = t200Build({ data: T200_A, picks: ['right'] })
  assert.match(t200Check(f[2], 'right').message, /水/)
  const g = t200Build({ data: T200_A, picks: ['right', 'down'] })
  assert.match(t200Check(g[4], 'up').message, /已经访问/)
  assert.deepEqual(t200Check(g[4], 'right'), { ok: true, message: '' })
})
check('[39.12] ⑫ 全水网格 → 单帧 done、0 岛、0 访问', () => {
  const f = t200Build({ data: { rows: 2, cols: 3, grid: [[0, 0, 0], [0, 0, 0]] } })
  assert.equal(f.length, 1)
  assert.equal(f[0].done, true)
  assert.equal(f[0].count, 0)
  assert.equal(f[0].visited, 0)
  assert.equal(f[0].ask, null)
})
check('[39.13] ⑬ 网格尺寸常量锁定', () => {
  assert.equal(tgrid.gridWidth(5), 284)
  assert.equal(tgrid.gridWidth(4), 226)
  assert.equal(tgrid.gridHeight(4), 226)
  assert.equal(tgrid.gridHeight(5), 284)
  assert.equal(tgrid.gridMaxWidth(5), 454)
  assert.equal(tgrid.gridMaxWidth(4), 362)
})
check('[39.14] ⑭ A/B 每帧布局坐标有限、末行列边界正确且 id 唯一', () => {
  for (const [data, picks] of [[T200_A, t200aFull], [T200_B, t200bFull]]) {
    const ids = Array.from({ length: data.rows * data.cols }, (_, i) => tgrid.cellId(Math.floor(i / data.cols), i % data.cols))
    assert.equal(new Set(ids).size, data.rows * data.cols)
    for (const fr of t200Build({ data, picks })) {
      const placed = tgrid.layoutCells(fr.cells)
      assert.equal(placed.length, data.rows * data.cols)
      for (const cell of placed) {
        for (const key of ['left', 'top', 'cx', 'cy']) assert.ok(Number.isFinite(cell[key]), `${cell.id} ${key} 非有限`)
        if (cell.c === fr.cols - 1) assert.equal(cell.left + tgrid.CELL, tgrid.gridWidth(fr.cols))
        if (cell.r === fr.rows - 1) assert.equal(cell.top + tgrid.CELL, tgrid.gridHeight(fr.rows))
      }
    }
  }
})
check('[39.15] ⑮ marks 只标已访问格，栈顶恒为 active 且至多一个', () => {
  for (const [data, picks] of [[T200_A, t200aFull], [T200_B, t200bFull]]) {
    for (const fr of t200Build({ data, picks })) {
      const visitedIds = fr.cells.filter((c) => c.order !== null).map((c) => c.id)
      assert.deepEqual(Object.keys(fr.marks).sort(), [...visitedIds].sort())
      const actives = Object.entries(fr.marks).filter(([, m]) => m === 'active').map(([id]) => id)
      if (fr.stack.length) assert.deepEqual(actives, [fr.stack.at(-1)])
      else assert.deepEqual(actives, [])
      for (const [, m] of Object.entries(fr.marks)) assert.ok(m === 'active' || m === 'ok')
    }
  }
})

// —— [40] P10-2-207：有向图几何与 Kahn 拓扑剥点 ——
const {
  buildFrames: t207Build,
  checkPick: t207Check,
  FIXTURE_A: T207_A,
  FIXTURE_B: T207_B,
} = await import('../src/demos/graph/course-schedule/engine.js')
const tgraph = await import('../src/core/graph-geom.js')

console.log('\n[40] 207 课程表')

const t207aFull = ['c0', 'c1', 'c2', 'c3', 'c4']
const t207bFull = ['c0', 'c1', 'c2']

check('[40.1] ① A 全对 → 10 帧；无环全剥，自动收尾 C5', () => {
  const f = t207Build({ data: T207_A, picks: t207aFull })
  const last = f.at(-1)
  assert.equal(f.length, 10)
  assert.equal(last.done, true)
  assert.equal(last.cycle, false)
  assert.equal(last.ask, null)
  assert.equal(last.peeled.length, 6)
  assert.equal(last.remaining.length, 0)
  assert.deepEqual(last.auto, ['c5'])
})
check('[40.2] ② B 全对 → 7 帧；停滞于三门环', () => {
  const f = t207Build({ data: T207_B, picks: t207bFull })
  const last = f.at(-1)
  assert.equal(f.length, 7)
  assert.equal(last.done, true)
  assert.equal(last.cycle, true)
  assert.equal(last.ask, null)
  assert.deepEqual(last.peeled, ['c0', 'c1', 'c2'])
  assert.deepEqual(last.remaining, ['c3', 'c4', 'c5'])
})
check('[40.3] ③ 帧序与 DAG / 有环帧数公式', () => {
  for (const [data, picks, expectedLength] of [[T207_A, t207aFull, 10], [T207_B, t207bFull, 7]]) {
    const f = t207Build({ data, picks })
    assert.equal(f.length, expectedLength)
    f.forEach((fr, i) => {
      if (i === f.length - 1) assert.equal(fr.done, true)
      else if (i % 2 === 1) assert.ok(fr.ask === null && !fr.done)
      else assert.ok(fr.ask !== null)
    })
  }
})
check('[40.4] ④ 正确剥除序列、候选项升序且标签对应节点', () => {
  for (const [data, picks, expected] of [
    [T207_A, t207aFull, ['c0', 'c1', 'c2', 'c3', 'c4']],
    [T207_B, t207bFull, ['c0', 'c1', 'c2']],
  ]) {
    const f = t207Build({ data, picks })
    assert.deepEqual(f.filter((fr) => fr.ask).map((fr) => fr.ask.correct), expected)
    expected.forEach((pick, i) => assert.equal(t207Check(f[i * 2], picks[i]).ok, true))
    for (const fr of f.filter((item) => item.ask)) {
      assert.deepEqual(fr.ask.options.map((option) => option.pick), fr.remaining)
      assert.deepEqual(fr.ask.options.map((option) => option.label), fr.remaining.map((id) => fr.nodes.find((node) => node.id === id).label))
    }
  }
})
check('[40.5] ⑤ 入度等于剩余前驱边数，已剥节点入度为 0', () => {
  for (const [data, picks] of [[T207_A, t207aFull], [T207_B, t207bFull]]) {
    for (const fr of t207Build({ data, picks })) {
      const remaining = new Set(fr.remaining)
      for (const node of fr.nodes) {
        if (remaining.has(node.id)) {
          assert.equal(fr.inDeg[node.id], fr.edges.filter((edge) => edge.to === node.id && remaining.has(edge.from)).length)
        } else {
          assert.equal(fr.inDeg[node.id], 0)
        }
      }
    }
  }
})
check('[40.6] ⑥ 每步剥 ready[0]，thawed 逐条对应下游入度变化', () => {
  const correctPicks = [
    [T207_A, ['c0', 'c1', 'c2', 'c3', 'c4']],
    [T207_B, ['c0', 'c1', 'c2']],
  ]
  for (const [data, picks] of correctPicks) {
    const f = t207Build({ data, picks })
    for (const fr of f.filter((item) => item.ask)) {
      assert.deepEqual(fr.ready, [...fr.ready].sort((a, b) => a.localeCompare(b)))
      assert.equal(fr.ask.correct, fr.ready[0])
    }
    picks.forEach((pick, i) => {
      const decision = f[i * 2]
      const result = f[i * 2 + 1]
      assert.equal(t207Check(decision, pick).ok, true)
      const beforeRemaining = new Set(decision.remaining)
      const expected = decision.edges
        .filter((edge) => edge.from === pick && beforeRemaining.has(edge.to))
        .map((edge) => ({ id: edge.to, from: decision.inDeg[edge.to], to: decision.inDeg[edge.to] - 1 }))
      assert.deepEqual(result.thawed, expected)
    })
  }
})
check('[40.7] ⑦ A 两次平局固定，第二次错选点名 C3 最小', () => {
  const f = t207Build({ data: T207_A, picks: t207aFull })
  assert.deepEqual(f[0].ready, ['c0', 'c1'])
  assert.deepEqual(f[6].ready, ['c3', 'c4'])
  const wrong = t207Check(f[6], 'c4')
  assert.equal(wrong.ok, false)
  assert.match(wrong.message, /C3/)
  assert.match(wrong.message, /最小/)
})
check('[40.8] ⑧ A f9 收尾 C5、入度变化与 active 标记锁定', () => {
  const f = t207Build({ data: T207_A, picks: t207aFull })[9]
  assert.deepEqual(f.auto, ['c5'])
  assert.deepEqual(f.peeled, ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'])
  assert.equal(f.marks.c5, 'active')
  assert.deepEqual(f.thawed, [{ id: 'c5', from: 1, to: 0 }])
})
check('[40.9] ⑨ B f6 停滞环的节点、入度和 marks 锁定', () => {
  const f = t207Build({ data: T207_B, picks: t207bFull })[6]
  assert.equal(f.cycle, true)
  assert.equal(f.ask, null)
  assert.deepEqual(f.remaining, ['c3', 'c4', 'c5'])
  assert.deepEqual(f.remaining.map((id) => f.inDeg[id]), [1, 1, 1])
  assert.deepEqual(f.remaining.map((id) => f.marks[id]), ['stuck', 'stuck', 'stuck'])
})
check('[40.10] ⑩ 入度错误文案点名先修课', () => {
  const a = t207Check(t207Build({ data: T207_A })[0], 'c2')
  assert.match(a.message, /C2/)
  assert.match(a.message, /C0、C1/)
  assert.match(a.message, /入度/)
  const b = t207Check(t207Build({ data: T207_B, picks: ['c0', 'c1'] })[4], 'c3')
  assert.match(b.message, /入度还有 2/)
  assert.match(b.message, /C2、C5/)
})
check('[40.11] ⑪ 顺序、已剥、终局与正确选择文案', () => {
  const f = t207Build({ data: T207_A, picks: t207aFull })
  assert.match(t207Check(f[6], 'c4').message, /最小/)
  assert.match(t207Check(f[2], 'c0').message, /已经剥过/)
  assert.match(t207Check(f[9], 'c0').message, /已经结束/)
  assert.deepEqual(t207Check(f[0], 'c0'), { ok: true, message: '' })
})
check('[40.12] ⑫ 错 pick 静默跳过且不改变帧数', () => {
  assert.equal(t207Build({ data: T207_A, picks: ['c1'] }).length, 1)
  assert.equal(
    t207Build({ data: T207_A, picks: ['c0', 'c0'] }).length,
    t207Build({ data: T207_A, picks: ['c0'] }).length,
  )
})
check('[40.13] ⑬ 图几何给定数字与入度 badge', () => {
  const c0 = T207_A.nodes[0]
  assert.equal(tgraph.NODE_R, 24)
  assert.equal(tgraph.ARROW, 9)
  assert.equal(tgraph.graphWidth(T207_A.nodes), 584)
  assert.equal(tgraph.graphHeight(T207_A.nodes), 244)
  assert.equal(tgraph.graphWidth(T207_B.nodes), 554)
  assert.equal(tgraph.graphHeight(T207_B.nodes), 234)
  assert.equal(tgraph.graphMaxWidth(T207_A.nodes), 660)
  assert.equal(tgraph.graphMaxWidth(T207_B.nodes), 660)
  assert.deepEqual(tgraph.badgeAt(c0), { cx: 53, cy: 43, r: 9.5 })
})
check('[40.14] ⑭ A/B 节点坐标与有向边裁剪、箭头长度一致', () => {
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
  for (const [data, picks] of [[T207_A, t207aFull], [T207_B, t207bFull]]) {
    for (const fr of t207Build({ data, picks })) {
      const placed = tgraph.layoutNodes(fr.nodes)
      const byId = new Map(placed.map((node) => [node.id, node]))
      for (const node of placed) {
        assert.ok(Number.isFinite(node.cx) && Number.isFinite(node.cy))
        assert.equal(node.cx, node.x)
        assert.equal(node.cy, node.y)
      }
      for (const edge of fr.edges) {
        const a = byId.get(edge.from)
        const b = byId.get(edge.to)
        const geo = tgraph.edgeGeo(a, b)
        assert.ok(Math.abs(distance(geo.start, [a.x, a.y]) - 24) < 1e-6)
        assert.ok(Math.abs(distance(geo.end, [b.x, b.y]) - 24) < 1e-6)
        assert.ok(Math.abs(distance(geo.end, geo.base) - 9) < 1e-6)
        assert.deepEqual(geo.head[0], geo.end)
      }
    }
  }
})
check('[40.15] ⑮ marks 与 peeled / cycle 状态逐帧一致', () => {
  for (const [data, picks] of [[T207_A, t207aFull], [T207_B, t207bFull]]) {
    for (const fr of t207Build({ data, picks })) {
      const nodeIds = new Set(fr.nodes.map((node) => node.id))
      const entries = Object.entries(fr.marks)
      assert.ok(entries.every(([id]) => nodeIds.has(id)))
      const markedPeeled = entries.filter(([, mark]) => mark === 'ok' || mark === 'active').map(([id]) => id).sort()
      assert.deepEqual(markedPeeled, [...fr.peeled].sort())
      const active = entries.filter(([, mark]) => mark === 'active').map(([id]) => id)
      assert.ok(active.length <= 1)
      if (fr.peeled.length) assert.deepEqual(active, [fr.peeled.at(-1)])
      else assert.deepEqual(active, [])
      const stuck = entries.filter(([, mark]) => mark === 'stuck').map(([id]) => id)
      if (fr.cycle) assert.deepEqual(stuck.sort(), [...fr.remaining].sort())
      else assert.deepEqual(stuck, [])
    }
  }
})
check('[40.16] thawed 只属于发生了剥点的帧，决策帧与停滞帧必须为空', () => {
  for (const [data, picks] of [[T207_A, t207aFull], [T207_B, t207bFull]]) {
    const f = t207Build({ data, picks })
    f.forEach((fr, i) => {
      const peeledThisFrame = i > 0 && fr.peeled.length !== f[i - 1].peeled.length
      if (!peeledThisFrame) assert.deepEqual(fr.thawed, [])
    })
  }
})

// —— [41] P10-3-994：多源 BFS 与队列先后 ——
const {
  buildFrames: t994Build,
  checkPick: t994Check,
  FIXTURE_A: T994_A,
  FIXTURE_B: T994_B,
} = await import('../src/demos/graph/rotten-oranges/engine.js')
const tgrid994 = await import('../src/core/grid-geom.js')

console.log('\n[41] 994 腐烂的橘子')

const t994aFull = ['g0-0', 'g2-4', 'g0-1', 'g1-0', 'g2-3', 'g0-2', 'g1-1']
const t994bFull = ['g0-0', 'g1-0', 'g0-1', 'g1-1']

check('[41.1] ① A 全对 → 14 帧、答案 3、自动收尾与 active 锁定', () => {
  const f = t994Build({ data: T994_A, picks: t994aFull })
  const last = f.at(-1)
  assert.equal(f.length, 14)
  assert.equal(last.done, true)
  assert.equal(last.answer, 3)
  assert.equal(last.ask, null)
  assert.deepEqual(last.queue, [])
  assert.equal(last.processed.length, 9)
  assert.equal(last.marks['g2-1'], 'active')
  assert.deepEqual(last.auto, ['g2-2', 'g2-1'])
})
check('[41.2] ② B 全对 → 8 帧、答案 -1、自动折叠与剩余新鲜格锁定', () => {
  const last = t994Build({ data: T994_B, picks: t994bFull }).at(-1)
  assert.equal(t994Build({ data: T994_B, picks: t994bFull }).length, 8)
  assert.equal(last.done, true)
  assert.equal(last.answer, -1)
  assert.deepEqual(last.queue, [])
  assert.deepEqual(last.auto, ['g0-2'])
  assert.deepEqual(last.cells.filter((cell) => cell.land && cell.order === null).map((cell) => cell.id), ['g2-2', 'g2-3', 'g2-4'])
})
check('[41.3] ③ 帧数公式与决策/结果帧奇偶', () => {
  const a = t994Build({ data: T994_A, picks: t994aFull })
  const b = t994Build({ data: T994_B, picks: t994bFull })
  const mid = t994Build({ data: T994_A, picks: t994aFull.slice(0, 3) })
  assert.equal(a.length, 2 * t994aFull.length)
  assert.equal(b.length, 2 * t994bFull.length)
  assert.equal(mid.length, 7)
  assert.ok(mid.at(-1).ask)
  for (const f of [a, b, mid]) f.forEach((fr, i) => {
    if (i % 2 === 0) assert.ok(fr.ask && !fr.done)
    else assert.equal(fr.ask, null)
  })
})
check('[41.4] ④ 决策正确项、完整选择序列与队列无重复', () => {
  for (const [data, picks, expected] of [[T994_A, t994aFull, t994aFull], [T994_B, t994bFull, t994bFull]]) {
    const f = t994Build({ data, picks })
    assert.deepEqual(f.filter((fr) => fr.ask).map((fr) => fr.ask.correct), expected)
    for (const fr of f) assert.equal(new Set(fr.queue).size, fr.queue.length)
  }
})
check('[41.5] ⑤ 每帧队列恒按变烂分钟、行、列排序', () => {
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks })) {
      const byId = new Map(fr.cells.map((cell) => [cell.id, cell]))
      const actual = fr.queue.map((id) => byId.get(id))
      const sorted = [...actual].sort((a, b) => a.order - b.order || a.r - b.r || a.c - b.c)
      assert.deepEqual(actual, sorted)
    }
  }
})
check('[41.6] ⑥ 计数守恒，processed 的变烂分钟非降', () => {
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks })) {
      const byId = new Map(fr.cells.map((cell) => [cell.id, cell]))
      assert.equal(fr.rotten, fr.processed.length + fr.queue.length)
      assert.equal(fr.land, fr.fresh + fr.rotten)
      const orders = fr.processed.map((id) => byId.get(id).order)
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
    }
  }
})
check('[41.7] ⑦ marks 与 processed 状态逐帧一致', () => {
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks })) {
      assert.deepEqual(Object.keys(fr.marks).sort(), [...fr.processed].sort())
      const active = Object.entries(fr.marks).filter(([, mark]) => mark === 'active').map(([id]) => id)
      assert.ok(active.length <= 1)
      if (fr.processed.length) assert.deepEqual(active, [fr.processed.at(-1)])
      else assert.deepEqual(active, [])
      for (const cell of fr.cells) {
        if (!cell.land || cell.order === null) assert.equal(fr.marks[cell.id], undefined)
      }
      for (const id of fr.processed.slice(0, -1)) assert.equal(fr.marks[id], 'ok')
    }
  }
})
check('[41.8] ⑧ 决策帧可点全部 15 格，其他帧不可点', () => {
  for (const fr of t994Build({ data: T994_A, picks: t994aFull })) {
    if (fr.ask) {
      assert.equal(fr.clickable.length, 15)
      assert.ok(fr.clickable.every((id) => fr.cells.some((cell) => cell.id === id)))
    } else assert.deepEqual(fr.clickable, [])
  }
})
check('[41.9] ⑨ 每个决策帧至少有两个候选', () => {
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks }).filter((item) => item.ask)) assert.ok(fr.queue.length >= 2)
  }
})
check('[41.10] ⑩ minute、answer 与 spread 的时刻吻合', () => {
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks })) {
      assert.equal(fr.minute, Math.max(0, ...fr.cells.map((cell) => cell.order ?? 0)))
      const byId = new Map(fr.cells.map((cell) => [cell.id, cell]))
      for (const item of fr.spread) assert.equal(item.minute, byId.get(item.id).order)
    }
  }
  assert.equal(t994Build({ data: T994_A, picks: t994aFull }).at(-1).answer, 3)
  const bLast = t994Build({ data: T994_B, picks: t994bFull }).at(-1)
  assert.equal(bLast.minute, 2)
  assert.equal(bLast.answer, -1)
})
check('[41.11] ⑪ 六帧 caption 与四类 hint 逐字锁定', () => {
  const a = t994Build({ data: T994_A, picks: t994aFull })
  const b = t994Build({ data: T994_B, picks: t994bFull })
  assert.equal(a[0].caption, '3×5 网格，2 个烂橘子、7 个新鲜橘子。烂橘子在第 0 分钟一起进队；处理一格时，它的新鲜四邻一起变烂、排到队尾。队列先比变烂的分钟，分钟相同再按行优先 —— 下一步处理哪一格由你判断。')
  assert.equal(a[1].caption, '处理 (0,0)：(0,1) 第 1 分钟变烂，(1,0) 第 1 分钟变烂。')
  assert.equal(a[2].caption, '已烂 4 / 9 格，队列里还有 3 格。轮到你判断下一步。')
  assert.equal(a[7].caption, '处理 (1,0)：它四邻没有新鲜橘子。')
  assert.equal(a[13].caption, '处理 (1,1)：(2,1) 第 3 分钟变烂。 剩下的队列格子都不会再让谁变烂，一并处理完（(2,2)、(2,1)）。 全部 9 个橘子都烂了，用了 3 分钟 —— 994 的答案是 3。')
  assert.equal(b[7].caption, '处理 (1,1)：它四邻没有新鲜橘子。 队列只剩一格，后面不再问，自动处理 (0,2)。 队列空了，(2,2)、(2,3)、(2,4) 还是新鲜的 —— 994 的答案是 -1。')
  assert.equal(a[0].hint, '队列先进先出：先比变烂的分钟，分钟相同再比行优先。')
  assert.equal(a[1].hint, '下一步还是从队列里挑 —— 先烂的先走。')
  assert.equal(a[13].hint, '每个橘子都烂了 —— 分钟数就是最后一格变烂的时刻。')
  assert.equal(b[7].hint, '队列空了还有新鲜橘子 —— 它们被空格隔开，等不到烂橘子。')
})
check('[41.12] ⑫ checkPick 九种情形的判错顺序与文案', () => {
  const a = t994Build({ data: T994_A, picks: t994aFull })
  const b = t994Build({ data: T994_B, picks: t994bFull })
  const cases = [
    [a[0], 'g2-4', '(2,4) 和 (0,0) 都是第 0 分钟变烂，同一分钟按行优先 —— (0,0) 在前。'],
    [a[2], 'g0-1', '(0,1) 是第 1 分钟才变烂，(2,4) 第 0 分钟就烂了 —— 先烂的先走。'],
    [a[6], 'g2-3', '(2,3) 和 (1,0) 都是第 1 分钟变烂，同一分钟按行优先 —— (1,0) 在前。'],
    [a[0], 'g0-3', '(0,3) 是空格 —— 空格永远不参与腐烂。'],
    [a[0], 'g1-1', '(1,1) 还没变烂 —— 只有已经烂的格子才在队列里。'],
    [a[2], 'g0-0', '(0,0) 已经处理过了 —— 每格只处理一次。'],
    [a[0], 'g9-9', '没有这一格：g9-9'],
    [a[1], 'g0-1', '现在没有要你决定的格子。'],
    [a[13], 'g1-1', '已经结束了，没有下一步要处理。'],
  ]
  for (const [frame, pick, message] of cases) assert.deepEqual(t994Check(frame, pick), { ok: false, message })
  assert.deepEqual(t994Check(b[0], 'g0-0'), { ok: true, message: '' })
  assert.equal(a[0].ask.prompt, '下一步处理队列里的哪一格？点网格里的格子。')
})
check('[41.13] ⑬ 三种退化数据都只出一帧且不提问', () => {
  const cases = [
    [{ rows: 2, cols: 2, grid: [[1, 1], [1, 1]] }, -1, '网格里没有烂橘子 —— 新鲜橘子永远不会烂，994 的答案是 -1。'],
    [{ rows: 2, cols: 2, grid: [[2, 2], [2, 2]] }, 0, '没有新鲜橘子 —— 一开始就是全烂，0 分钟，994 的答案是 0。'],
    [{ rows: 1, cols: 3, grid: [[2, 1, 0]] }, 1, '开局只有 1 个烂橘子 —— 没有可判断的先后，直接一次跑完。全部 2 个橘子都烂了，用了 1 分钟 —— 994 的答案是 1。'],
  ]
  for (const [data, answer, caption] of cases) {
    const f = t994Build({ data })
    assert.equal(f.length, 1)
    assert.equal(f[0].ask, null)
    assert.equal(f[0].answer, answer)
    assert.equal(f[0].caption, caption)
  }
})
check('[41.14] ⑭ 错 pick 静默跳过，不产帧也不吞后续正确 pick', () => {
  assert.equal(t994Build({ data: T994_A, picks: ['g0-0', 'g2-4', 'g2-4'] }).length, 5)
  assert.equal(t994Build({ data: T994_A, picks: ['g0-0', 'g2-4'] }).length, 5)
  assert.equal(t994Build({ data: T994_A, picks: ['g0-1'] }).length, 1)
})
check('[41.15] ⑮ buildFrames 是纯函数', () => {
  const first = t994Build({ data: T994_A, picks: t994aFull })
  const second = t994Build({ data: T994_A, picks: t994aFull })
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})
check('[41.16] ⑯ GridCanvas 几何：格 id 与中心点坐标逐帧吻合', () => {
  assert.equal(tgrid994.CELL, 52)
  assert.equal(tgrid994.CELL_GAP, 6)
  for (const [data, picks] of [[T994_A, t994aFull], [T994_B, t994bFull]]) {
    for (const fr of t994Build({ data, picks })) {
      const placed = tgrid994.layoutCells(fr.cells)
      assert.equal(placed.length, fr.rows * fr.cols)
      for (const cell of placed) {
        assert.equal(cell.id, `g${cell.r}-${cell.c}`)
        assert.equal(cell.cx, cell.c * 58 + 26)
        assert.equal(cell.cy, cell.r * 58 + 26)
      }
    }
  }
})

console.log(`\n最终汇总：${failures.length === 0 ? '全部通过' : '有失败'}：${passed} passed, ${failures.length} failed\n`)
if (failures.length) process.exit(1)
