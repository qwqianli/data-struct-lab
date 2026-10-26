/**
 * 二分查找的教学引擎。
 *
 * 设计要点：**这里是纯函数，没有任何 Vue 依赖**。
 * 全部状态由「初始数据 + 用户点击序列（picks）」重放得出，
 * 于是「撤销」只是 picks.pop()，「分享一次练习」只是序列化 picks。
 * 将来加单测时可以直接调 buildFrames 断言帧序列，不需要挂载组件。
 *
 * 另一个关键设计：**用户必须自己算出中点再点击**。
 * 如果由代码算好 mid 直接高亮，这个演示就退回成 visualgo 那种「只能看」，
 * 而「看 + 练」的差别恰恰在于：要让人自己犯一次「上中点 / 下中点」的错。
 */

export const DEFAULT_VALUES = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
export const DEFAULT_TARGET = 23

/**
 * 统一取下中点。
 * 不用 (low + high) >> 1 是因为教学上要让学习者看到 (0+9)//2 这个算式本身，
 * 而 >>1 在负数区间会向负无穷取整，是个不值得在入门演示里埋的坑。
 */
export function expectedMid(low, high) {
  return Math.floor((low + high) / 2)
}

/**
 * 重放出完整帧序列。
 * @param {{values?: number[], target?: number, picks?: number[]}} options
 * @returns {Frame[]}
 */
export function buildFrames({ values = DEFAULT_VALUES, target = DEFAULT_TARGET, picks = [] } = {}) {
  const frames = []
  const eliminated = new Set()

  let low = 0
  let high = values.length - 1
  let compares = 0

  frames.push({
    values,
    target,
    low,
    high,
    mid: null,
    eliminated: [],
    found: false,
    dead: false,
    compares,
    caption: `目标值是 ${target}，数组已升序排列。当前搜索区间 [${low}, ${high}]，共 ${high - low + 1} 个元素。`,
    hint: `先在草稿纸上算 (${low} + ${high}) // 2，再点那个下标 —— 别让代码替你算。`,
  })

  for (const pick of picks) {
    if (low > high) break

    const m = expectedMid(low, high)
    // 非法的 pick 直接跳过而不报错：校验由 checkPick 负责，这里只负责重放
    if (pick !== m) continue

    const v = values[m]
    const oldLow = low
    const oldHigh = high
    compares += 1

    if (v === target) {
      frames.push({
        values,
        target,
        low,
        high,
        mid: m,
        eliminated: [...eliminated],
        found: true,
        dead: false,
        compares,
        caption: `a[${m}] 就是 ${target}，命中。第 ${compares} 次比较就结束了。`,
        hint: '对比一下线性查找：最坏要 10 次。这就是「每比较一次排除一半」的价值。',
      })
      break
    }

    let caption
    if (v < target) {
      for (let i = oldLow; i <= m; i += 1) eliminated.add(i)
      low = m + 1
      caption = `a[${m}] = ${v} < ${target}，目标只可能在右边 —— 下标 ${oldLow}~${m} 全部排除，区间缩到 [${low}, ${high}]。`
    } else {
      for (let i = m; i <= oldHigh; i += 1) eliminated.add(i)
      high = m - 1
      caption = `a[${m}] = ${v} > ${target}，目标只可能在左边 —— 下标 ${m}~${oldHigh} 全部排除，区间缩到 [${low}, ${high}]。`
    }

    const dead = low > high
    frames.push({
      values,
      target,
      low,
      high,
      mid: m,
      eliminated: [...eliminated],
      found: false,
      dead,
      compares,
      caption: dead ? `${caption} 区间已空，说明 ${target} 不在这组数据里。` : caption,
      hint: dead
        ? '二分查找能定位「找不到」也是它的本事 —— 区间空了就是明确的答案。'
        : `新区间有 ${high - low + 1} 个元素。继续算 (${low} + ${high}) // 2，点下去。`,
    })

    if (dead) break
  }

  return frames
}

/**
 * 校验一次点击。返回 ok:false 时附带的反馈文案，是这个演示最主要的教学价值——
 * 新手在二分查找上翻车的原因基本只有三种：上/下中点取反、区间没排除 mid 本身、
 * 混淆了「下标」和「值」。
 */
export function checkPick(frame, index) {
  if (!frame) return { ok: false, message: '没有可用的帧。' }
  if (frame.found) return { ok: false, message: '已经找到了，点「重来」可以再练一次。' }
  if (frame.dead) return { ok: false, message: '区间已经空了，这道题已经结束，点「重来」再来一遍。' }

  const m = expectedMid(frame.low, frame.high)

  if (index === m) return { ok: true, message: '' }

  if (index < frame.low || index > frame.high) {
    return {
      ok: false,
      message: `下标 ${index} 已经不在当前区间 [${frame.low}, ${frame.high}] 里 —— 那一段在上一轮就被排除了，不用再比较。`,
    }
  }

  const upperMid = Math.ceil((frame.low + frame.high) / 2)
  if (index === upperMid) {
    return {
      ok: false,
      message: `你取的是上中点。本演示统一取下中点：(${frame.low} + ${frame.high}) // 2 = ${m}，也就是 a[${m}] = ${frame.values[m]}。两种取法都对，但全程必须统一，否则区间会算歪。`,
    }
  }

  return {
    ok: false,
    message: `中点算错了：(${frame.low} + ${frame.high}) // 2 = ${m}，应该点下标 ${m}（值是 ${frame.values[m]}），你点的是下标 ${index}（值是 ${frame.values[index]}）。`,
  }
}
