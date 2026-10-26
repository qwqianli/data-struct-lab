<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_K, DEFAULT_NUMS, EXPIRE_K, EXPIRE_NUMS } from './engine.js'

/**
 * 双状态模型（同 739）：picks 是进度（进 URL），viewIndex 只管当前看到第几帧。
 * 同一轮可能「弹多次 + 压一次」多帧，弹出帧必须逐帧能看。
 * 零渲染器改动：数组复用 ArrayCanvas（窗口用 marks 表达），队列在下面内联画。
 */
const nums = ref(DEFAULT_NUMS)
const k = ref(DEFAULT_K)

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

// picks 是 'pop-tail' / 'push' 的序列，?picks=push,pop-tail 可复现任意一次练习
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ nums: nums.value, k: k.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)

// 决策只发生在「最后一帧且队列非空」：队空的那一帧没有选择余地（引擎自动压入）
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && frame.value.phase === 'ask' && frame.value.queue.length > 0,
)

// 窗口用 marks 表达：连续 k 个琥珀格子会跟着 window.left 平移，不画框
const marks = computed(() => {
  const w = frame.value.window
  if (w === null) return {}
  const m = {}
  for (let i = w.left; i <= w.right; i += 1) m[i] = 'active'
  return m
})

const answeredCount = computed(() => frame.value.answers.filter((a) => a !== null).length)

// 队列内联 SVG 的几何：横排格子 56×36、间距 10，队首描边蓝、队尾紫
const Q_CELL_W = 56
const Q_CELL_H = 36
const Q_GAP = 10
const Q_PAD = 16
const queueWidth = computed(
  () => Q_PAD * 2 + Math.max(frame.value.queue.length, 1) * Q_CELL_W + Math.max(frame.value.queue.length - 1, 0) * Q_GAP,
)
function queueX(j) {
  return Q_PAD + j * (Q_CELL_W + Q_GAP)
}
function queueCellClass(j) {
  const last = frame.value.queue.length - 1
  if (j === 0) return 'q-cell q-cell--front'
  if (j === last) return 'q-cell q-cell--back'
  return 'q-cell'
}

// 从 URL 恢复进度时直接落在最新一帧：分享链接第一眼就是当前状态（同 206/141/739）
viewIndex.value = frames.value.length - 1

function onPick(action) {
  const result = checkPick(frame.value, action)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length
  picks.value.push(action)
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

/**
 * 两组数据各管一半机制：官方数据把「弹队尾」演示充分，
 * 但队首从没过期过；[5,3,1,2,4] 专门补「左出」这一半。切换即清空进度。
 */
function switchData(nextNums, nextK) {
  if (nums.value === nextNums) return
  nums.value = nextNums
  k.value = nextK
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">队列 · 单调队列</div>
        <h2>滑动窗口最大值 · 单调队列 <span class="pill pill--hard">239 · 难</span></h2>
        <p class="lede">
          窗口往右滑，随时报出窗口里的最大值。<b>队尾该不该弹由你选</b> —— 队里存的是
          <b>下标</b>，从队头到队尾值递减，所以队头永远是最大值。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/sliding-window-maximum/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === DEFAULT_NUMS }" @click="switchData(DEFAULT_NUMS, DEFAULT_K)">
            官方数据  [1,3,-1,-3,5,3,6,7]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === EXPIRE_NUMS }" @click="switchData(EXPIRE_NUMS, EXPIRE_K)">
            队首过期  [5,3,1,2,4]
          </button>
        </div>
        <span class="stage-side">琥珀色格子 = 当前窗口</span>
      </div>

      <div class="board">
        <ArrayCanvas :values="frame.nums" :marks="marks" />

        <div class="queue-block">
          <span class="row-label">队列</span>
          <svg
            class="queue-svg"
            :viewBox="`0 0 ${queueWidth} 72`"
            :style="{ aspectRatio: `${queueWidth} / 72`, maxWidth: `${queueWidth}px` }"
          >
            <template v-if="frame.queue.length">
              <!-- 只有一个元素时队头队尾是同一个格子：标签分居格子左右（x=30 / 58），别叠在一起 -->
              <text
                class="q-label"
                :x="frame.queue.length === 1 ? queueX(0) + 14 : queueX(0) + Q_CELL_W / 2"
                y="12"
                text-anchor="middle"
              >
                队头
              </text>
              <text
                class="q-label"
                :x="frame.queue.length === 1 ? queueX(0) + Q_CELL_W - 14 : queueX(frame.queue.length - 1) + Q_CELL_W / 2"
                y="12"
                text-anchor="middle"
              >
                队尾
              </text>
            </template>
            <g
              v-for="(item, j) in frame.queue"
              :key="item.id"
              :style="{ transform: `translate(${queueX(j)}px, 22px)` }"
            >
              <rect :class="queueCellClass(j)" :width="Q_CELL_W" :height="Q_CELL_H" rx="7" />
              <text class="q-text" :x="Q_CELL_W / 2" :y="Q_CELL_H / 2" dy="0.35em" text-anchor="middle">
                #{{ item.index }}
              </text>
            </g>
            <g v-if="!frame.queue.length" :style="{ transform: `translate(${Q_PAD}px, 22px)` }">
              <rect class="q-cell q-cell--empty" :width="Q_CELL_W" :height="Q_CELL_H" rx="7" />
              <text class="q-text q-text--dim" :x="Q_CELL_W / 2" :y="Q_CELL_H / 2" dy="0.35em" text-anchor="middle">
                空
              </text>
            </g>
          </svg>
        </div>

        <div class="answers-block">
          <span class="row-label">答案</span>
          <div class="answers">
            <div
              v-for="(a, j) in frame.answers"
              :key="j"
              class="answer"
              :class="{ 'answer--set': a !== null }"
            >
              {{ a === null ? '?' : a }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': atDecision }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <div v-if="atDecision" class="ask">
      <p class="ask-prompt">
        第 {{ frame.cursor }} 个是 {{ frame.nums[frame.cursor] }}，队尾是 #{{
          frame.queue[frame.queue.length - 1].index
        }}（{{ frame.nums[frame.queue[frame.queue.length - 1].index] }}）—— 弹不弹？
      </p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('pop-tail')">弹出队尾（它不可能再是最大值了）</button>
        <button class="ask-btn" @click="onPick('push')">压入当前（队尾还比它大）</button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.phase === 'done'" class="verdict verdict--ok">
      <b>窗口最大值 [{{ frame.answers.join(', ') }}]。</b>队列里剩的下标在窗口内一定是递减的，所以队首永远是最大值。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已处理 <b>{{ frame.cursor }}</b> / {{ nums.length }}</span>
        <span class="dot">·</span>
        <span>队列长度 <b>{{ frame.queue.length }}</b></span>
        <span class="dot">·</span>
        <span>已出答案 <b>{{ answeredCount }}</b> 个</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「窗口右进左出 + 队首即答案」。下面四题各多考一个东西，按顺序做。</p>
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

.pill--hard {
  color: #e79b96;
  border-color: #57352f;
  background: #241310;
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
  padding: 18px 20px 16px;
  margin-bottom: 16px;
}

.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.modes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-btn {
  font-size: 12px;
  padding: 5px 12px;
  font-family: var(--font-mono);
}

.mode-btn--on {
  background: #1b3b66;
  border-color: #2f5f9e;
  color: var(--text-strong);
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
}

.board {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.queue-block,
.answers-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.row-label {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
}

.queue-svg {
  width: 100%;
  display: block;
  overflow: visible;
}

.q-cell {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    stroke 0.3s ease,
    fill 0.3s ease;
}

/* 队头蓝、队尾紫：和数组/链表演示里左右指针的配色同族 */
.q-cell--front {
  stroke: var(--accent);
  stroke-width: 2;
}

.q-cell--back {
  stroke: var(--accent-2);
  stroke-width: 2;
}

.q-cell--empty {
  stroke-dasharray: 5 4;
  opacity: 0.6;
}

.q-text--dim {
  fill: var(--text-dim);
}

.q-text {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  user-select: none;
}

.q-label {
  fill: var(--text-dim);
  font-size: 11px;
  font-family: var(--font-mono);
  user-select: none;
}

/* 队首被移除时其余元素整体左移一格，靠 transform 过渡平滑完成 */
.queue-svg g {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.answers {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.answer {
  min-width: 40px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: 1px solid var(--line-soft);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-dim);
  padding: 0 6px;
  user-select: none;
  transition:
    color 0.3s ease,
    border-color 0.3s ease;
}

.answer--set {
  color: var(--ok);
  border-color: #1f5138;
  font-weight: 700;
}

.say {
  border-left: 3px solid var(--line);
  padding: 2px 0 2px 14px;
  margin-bottom: 14px;
}

.say--ask {
  border-left-color: var(--accent);
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
  flex: 1 1 240px;
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

.rel-diff--中 {
  color: #e3c07a;
  border-color: #574526;
}

.rel-diff--难 {
  color: #e79b96;
  border-color: #57352f;
}

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
