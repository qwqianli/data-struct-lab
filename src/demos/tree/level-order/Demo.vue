<script setup>
import { computed, ref } from 'vue'
import TreeCanvas from '../../../components/TreeCanvas.vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_NUMS, FIXTURE_A, FIXTURE_B } from './engine.js'

/**
 * 双状态模型（同 94）：picks 是唯一进度状态（进 URL），viewIndex 只管看到第几帧。
 * 纯点击题：点 TreeCanvas 的格子 = 出队；答错的点击不产帧，反馈文案来自 checkPick。
 *
 * 数据集不进 URL。A、B 的开局可点集都是 ['s0']（两棵树的根都在 s0），
 * 94 那招「首格判数据集」在这里失灵 —— 改用全序列复放判定：
 * 哪组数据能把整份 picks 一口气吃成 done 且帧数 = 1+2×picks 长度，就落哪组；都不中回落 A。
 */
function resolveNums(picks) {
  if (!picks.length) return DEFAULT_NUMS
  for (const nums of [FIXTURE_A, FIXTURE_B]) {
    const f = buildFrames({ nums, picks })
    if (f[f.length - 1].done && f.length === 1 + 2 * picks.length) return nums
  }
  return DEFAULT_NUMS
}

const rawPicks = (new URLSearchParams(window.location.search).get('picks') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const nums = ref(resolveNums(rawPicks))

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

const picks = ref(rawPicks)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ nums: nums.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const realCount = computed(() => frames.value[0].cells.filter((c) => !c.empty).length)
// 当前层：队列最前面的层号；队列空了 = 已到最深处的下一层（不可能）
const curLayer = computed(() => {
  const q = frame.value.queue
  if (!q.length) return frame.value.levels
  return frame.value.cellsById[q[0]].d
})

// 决策只发生在「最后一帧且引擎给出可点集合」：中间帧只是在回看，点树不响应
const atDecision = computed(() => viewIndex.value === frames.value.length - 1 && frame.value.clickable.length > 0)

// 序列输出面：只有新出队的那一格标绿
const seqMarks = computed(() => (frame.value.seqMark === null ? {} : { [frame.value.seqMark]: 'ok' }))

const groupsText = computed(() => frame.value.groups.map((g) => `[${g.join('、')}]`).join(' '))

// 从 URL 恢复进度时直接落在最新一帧：分享出去的链接第一眼就是当前状态（同 94）
viewIndex.value = frames.value.length - 1

function onPick(id) {
  if (!atDecision.value) return
  const result = checkPick(frame.value, id)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length // 新增的帧从「当前决策帧 + 1」开始
  picks.value.push(id)
  viewIndex.value = firstNew
}

function advance() {
  if (canAdvance.value) viewIndex.value += 1
}

function undo() {
  if (!picks.value.length) return
  picks.value.pop()
  feedback.value = ''
  viewIndex.value = frames.value.length - 1
}

function reset() {
  picks.value = []
  feedback.value = ''
  viewIndex.value = 0
}

/** A 专考「层末换层」，B 是满层 8 节点（层界指针全开）。切换即清空进度。 */
function switchData(next) {
  if (nums.value === next) return
  nums.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">二叉树 · 层序遍历</div>
        <h2>二叉树的层序遍历 <span class="pill pill--mid">102 · 中</span></h2>
        <p class="lede">
          一层一层、从左到右。<b>下一个出队的节点由你点出来</b>：队首永远是正解 ——
          本层出完的那一刻，队首会换成下一层第一个，这一轮换就是「一层什么时候结束」。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/binary-tree-level-order-traversal/"
        target="_blank"
        rel="noreferrer"
      >
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === FIXTURE_A }" @click="switchData(FIXTURE_A)">
            官方数据&nbsp;&nbsp;[3,9,20,null,null,15,7]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            满层八节点&nbsp;&nbsp;[1,2,3,4,5,6,7,8]
          </button>
        </div>
        <span class="stage-side">琥珀 = 正在出队 · 绿 = 已出队 · 蓝线 = 刚进队的孩子</span>
      </div>

      <TreeCanvas
        :cells="frame.cells"
        :edges="frame.edges"
        :pointers="frame.pointers"
        :marks="frame.marks"
        :clickable="atDecision ? frame.clickable : []"
        :levels="frame.levels"
        @node-click="onPick"
      />
    </section>

    <section class="seq-block">
      <span class="row-label">出队序列（扁平）</span>
      <ArrayCanvas :values="frame.seq" :marks="seqMarks" :pointers="frame.pointers" />
    </section>

    <section class="say">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>层序完成。</b>{{ realCount }} 个节点、{{ frame.levels }} 层：{{ groupsText }} ——
      每层开始的位置在序列上都有 d 标签，那就是分组答案的层界。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已出队 <b>{{ frame.outputIds.length }}</b> / {{ realCount }}</span>
        <span class="dot">·</span>
        <span>当前层 <b>{{ curLayer }}</b> / {{ frame.levels }}</span>
        <span class="dot">·</span>
        <span>点队首那个格子推进</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练「队列 + 层界」。下面四题各多考一个东西，按顺序做。</p>
      <ul class="rel-list">
        <li v-for="r in related" :key="r.no" class="rel">
          <a class="rel-link" :href="`https://leetcode.cn/problems/${r.slug}/`" target="_blank" rel="noreferrer">
            <span class="rel-no">{{ r.no }}</span>
            <span class="rel-title">{{ r.title }}</span>
            <span class="rel-diff" :class="`rel-diff--${r.difficulty}`">{{ r.difficulty }}</span>
          </a>
          <p class="rel-why">{{ r.why }}</p>
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.demo {
  max-width: 940px;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.crumb {
  font-size: 12px;
  color: var(--text-dim);
  letter-spacing: 0.4px;
  margin-bottom: 6px;
}

h2 {
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 650;
  color: var(--text-strong);
  letter-spacing: 0.2px;
}

.pill {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
}

.pill--mid {
  color: #e3c07a;
  border-color: #574526;
  background: #241d0e;
}

.lede {
  margin: 0;
  color: var(--text);
  font-size: 13.5px;
  max-width: 640px;
}

.lede b {
  color: var(--text-strong);
  font-weight: 600;
}

.external {
  flex: none;
  font-size: 12.5px;
  color: var(--accent);
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 6px 13px;
  white-space: nowrap;
  transition: border-color 0.18s ease;
}

.external:hover {
  border-color: #35557f;
}

.stage {
  background: linear-gradient(180deg, #101825 0%, #0e1520 100%);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px 14px;
  margin-bottom: 14px;
}

.stage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.modes {
  display: flex;
  gap: 8px;
}

.mode-btn {
  font-size: 12px;
  padding: 5px 11px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease;
}

.mode-btn--on {
  color: var(--text-strong);
  border-color: #35557f;
  background: #12203a;
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
}

.seq-block {
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 12px 20px 16px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.seq-block .row-label {
  flex: none;
}

.row-label {
  font-size: 11.5px;
  color: var(--text-dim);
  letter-spacing: 0.4px;
}

/* ArrayCanvas 的指针按名字取色（.tag--<name>），d2/d3/d4 不在内置名单里 ——
   从 Demo 侧补色，不动渲染器 */
.seq-block :deep(.tag--d2 text),
.seq-block :deep(.tag--d3 text),
.seq-block :deep(.tag--d4 text) {
  fill: var(--accent);
}

.seq-block :deep(.tag--d2 path),
.seq-block :deep(.tag--d3 path),
.seq-block :deep(.tag--d4 path) {
  fill: var(--accent);
}

.say {
  border-left: 3px solid var(--accent);
  padding: 2px 0 2px 14px;
  margin-bottom: 14px;
}

.say-text {
  margin: 0 0 5px;
  color: var(--text-strong);
  font-size: 13.5px;
}

.say-hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 12.5px;
}

.caret {
  color: var(--accent);
  margin-right: 6px;
}

.feedback {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #2a1810;
  border: 1px solid #5c3620;
  color: #ffc48a;
  font-size: 13px;
  animation: pop 0.18s ease;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.verdict {
  margin-bottom: 14px;
  padding: 11px 15px;
  border-radius: 9px;
  font-size: 13px;
  line-height: 1.7;
}

.verdict--ok {
  background: #0f2519;
  border: 1px solid #1f5138;
  color: #a8e3c1;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--line-soft);
}

.stats {
  font-size: 12.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.stats b {
  color: var(--text-strong);
  font-weight: 600;
}

.dot {
  margin: 0 8px;
  opacity: 0.5;
}

.actions {
  display: flex;
  gap: 9px;
}

.next {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
}

.next h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.next-note {
  margin: 0 0 14px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.rel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 9px;
}

.rel {
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  padding: 10px 14px;
  transition: border-color 0.18s ease;
}

.rel:hover {
  border-color: #2e4054;
}

.rel-link {
  display: flex;
  align-items: baseline;
  gap: 10px;
  text-decoration: none;
}

.rel-no {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  min-width: 34px;
}

.rel-title {
  color: var(--text-strong);
  font-size: 13.5px;
  font-weight: 550;
}

.rel-diff {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
}

.rel-diff--易 {
  color: #7fd6a8;
  border-color: #24513c;
}

.rel-diff--中 {
  color: #e3c07a;
  border-color: #574526;
}

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
