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

console.log(`\n最终汇总：${failures.length === 0 ? '全部通过' : '有失败'}：${passed} passed, ${failures.length} failed\n`)
if (failures.length) process.exit(1)
