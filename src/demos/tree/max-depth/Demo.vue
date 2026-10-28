<script setup>
import { computed, ref } from 'vue'
import TreeCanvas from '../../../components/TreeCanvas.vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_NUMS, FIXTURE_A, FIXTURE_B } from './engine.js'

/**
 * 双状态模型（同 94/102）：picks 是唯一进度状态（进 URL），viewIndex 只管看到第几帧。
 * 本题是混合词汇：点格子（进入）+ 选「带回几」（回溯值预测，本题唯一 UI 新增）。
 * 用户必须先选、引擎再揭示 —— 点完就自动给答案等于替用户算，是本 demo 的头号禁忌。
 *
 * 数据集不进 URL。A、B 的开局可点集都是 ['s0']，改用全序列复放判定：
 * 哪组数据能把整份 picks 吃到 done，就落哪组；都不中回落 A。
 */
function resolveNums(picks) {
  if (!picks.length) return DEFAULT_NUMS
  for (const nums of [FIXTURE_A, FIXTURE_B]) {
    if (buildFrames({ nums, picks }).at(-1).done) return nums
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
const waitingAsk = computed(() => frame.value.ask !== null)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const realCount = computed(() => frames.value[0].cells.filter((c) => !c.empty).length)

// 决策只发生在最后一帧：格子决策（clickable 非空）或预测决策（ask 在场）
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && (frame.value.clickable.length > 0 || frame.value.ask !== null),
)

// 答案行：只有最新合并的那一格标绿
const answerMarks = computed(() =>
  frame.value.answerMark === null || frame.value.answerMark === undefined
    ? {}
    : { [frame.value.answerMark]: 'ok' },
)

// 当前层：active 格子的 d（进入/提问/空格轮的主角所在层）
const curDepth = computed(() => {
  const id = Object.keys(frame.value.marks).find((k) => frame.value.marks[k] === 'active')
  if (!id) return 0
  const c = frame.value.cellsById[id]
  return c ? c.d : 0
})

// 从 URL 恢复进度时直接落在最新一帧：分享出去的链接第一眼就是当前状态（同 94/102）
viewIndex.value = frames.value.length - 1

function onPick(pick) {
  if (!atDecision.value) return
  const result = checkPick(frame.value, pick)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length // 新帧从「当前决策帧 + 1」开始
  picks.value.push(pick)
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

/** A 是官方满二叉样例（空格全在最深层、不画）；B 是左斜 4 层链（带 2 个中层空格轮）。切换即清空进度。 */
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
        <div class="crumb">二叉树 · 最大深度</div>
        <h2>二叉树的最大深度 <span class="pill pill--easy">104 · 易</span></h2>
        <p class="lede">
          深度不是数出来的，是<b>回溯带回来的</b>：每个节点带回 max(左, 右) + 1。你负责点格子走进去，
          并在子树走完时<b>预测它该带回几</b> —— 猜错不惩罚路径，只让你重选。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/maximum-depth-of-binary-tree/"
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
            左斜四层&nbsp;&nbsp;[1,2,null,3,null,4]
          </button>
        </div>
        <span class="stage-side">琥珀 = 当前节点 · 绿 = 已合并 · 蓝线 = 递归栈</span>
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
      <span class="row-label">回溯值（答案行）</span>
      <ArrayCanvas :values="frame.answer" :marks="answerMarks" />
    </section>

    <section class="say" :class="{ 'say--ask': waitingAsk }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <div v-if="frame.ask" class="ask">
      <p class="ask-prompt">{{ frame.ask.prompt }}</p>
      <div class="ask-options">
        <button v-for="opt in frame.ask.options" :key="opt.pick" class="ask-btn" @click="onPick(opt.pick)">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done && frame.depth !== null" class="verdict verdict--ok">
      <b>走完了。</b>最大深度 = <b>{{ frame.depth }}</b> —— 就是根节点最后带回的那个值。
      答案行共 {{ frame.answer.length }} 次回溯、单调不减：每个父节点带回来的都不小于它的孩子。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已合并 <b>{{ frame.mergedIds.length }}</b> / {{ realCount }}</span>
        <span class="dot">·</span>
        <span>当前层 <b>{{ curDepth }}</b> / {{ frame.levels }}</span>
        <span class="dot">·</span>
        <span>点格子进入，子树走完选「带回几」</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练「回溯带值」。下面四题各多考一个东西，按顺序做。</p>
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

.pill--easy {
  color: #7fd6a8;
  border-color: #24513c;
  background: #10241a;
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

/* TreeCanvas 的指针默认全走 accent；back 从 Demo 侧换色区分，不动渲染器 */
.stage :deep(.tag--back text) {
  fill: var(--accent-2);
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

.say {
  border-left: 3px solid var(--accent);
  padding: 2px 0 2px 14px;
  margin-bottom: 14px;
}

.say--ask {
  border-left-color: #e3c07a;
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

.ask {
  margin-bottom: 14px;
  padding: 12px 15px;
  border: 1px solid #27405e;
  border-radius: 9px;
  background: #12203a;
}

.ask-prompt {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-strong);
}

.ask-options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.ask-btn {
  flex: 1 1 200px;
  text-align: left;
  padding: 9px 14px;
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

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
