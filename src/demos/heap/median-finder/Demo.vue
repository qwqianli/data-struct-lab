<script setup>
import { computed, ref } from 'vue'
import TreeCanvas from '../../../components/TreeCanvas.vue'
import { buildFrames, checkPick, DEFAULT_DATA, FIXTURE_A, FIXTURE_B } from './engine.js'

/**
 * 双状态模型（同前七题）：picks 是唯一进度状态（进 URL），viewIndex 只管看到第几帧。
 * 两个 TreeCanvas 并排、**都开 noScale**（L=2 原宽 190，两 190 + 缝 16 = 396 ≤ 900）——
 * 这是 noScale 的第一个真正用户，漏传一个就会被放大 1.6 倍挤爆两栏。
 * 判断题是「新元素进哪个堆」，clickable 全程 []；搬移是机械补偿，只在结果帧点亮路径。
 *
 * 数据集不进 URL，两组按全序列复放判定（哪组把整份 picks 吃到 done 就落哪组，都不中回落 A）。
 */
function resolveData(picks) {
  if (!picks.length) return DEFAULT_DATA
  for (const data of [FIXTURE_A, FIXTURE_B]) {
    if (buildFrames({ stream: data.stream, picks }).at(-1).done) return data
  }
  return DEFAULT_DATA
}

const rawPicks = (new URLSearchParams(window.location.search).get('picks') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const data = ref(resolveData(rawPicks))

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

const picks = ref(rawPicks)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ stream: data.value.stream, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)

// 决策只发生在最后一帧的 ask 上；两棵树都不可点
const atDecision = computed(() => viewIndex.value === frames.value.length - 1 && frame.value.ask !== null)

// 从 URL 恢复进度时直接落在最新一帧：分享出去的链接第一眼就是当前状态（同前七题）
viewIndex.value = frames.value.length - 1

function onPick(pick) {
  if (!atDecision.value) return
  const result = checkPick(frame.value, pick)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length
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

/** A 五元素（两次小顶→大顶搬移）；B 六元素（第 2–6 步每步一搬，平衡看得最清楚）。切换即清空进度。 */
function switchData(next) {
  if (data.value === next) return
  data.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">堆 · 双堆中位数</div>
        <h2>数据流的中位数 <span class="pill pill--hard">295 · 难</span></h2>
        <p class="lede">
          大顶堆存<b>较小的一半</b>、小顶堆存<b>较大的一半</b>，中位数永远来自两个堆顶。<b
            >新元素进哪个堆由你判断</b>（和大顶堆顶比一次就行）；搬移是维护平衡的机械补偿，不劳你点。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/find-median-from-data-stream/"
        target="_blank"
        rel="noreferrer"
      >
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_A }" @click="switchData(FIXTURE_A)">
            五元素&nbsp;&nbsp;[1,3,2,5,4]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            六元素&nbsp;&nbsp;[5,2,6,1,4,3]
          </button>
        </div>
        <span class="stage-side">琥珀 = 刚进/刚搬的节点 · 蓝 = 搬移走过的链 · 两画布都不缩放</span>
      </div>

      <div class="board">
        <div class="tree-col">
          <span class="row-label">大顶堆（较小的一半）</span>
          <TreeCanvas
            :cells="frame.maxTree.cells"
            :edges="frame.maxTree.edges"
            :marks="frame.marksMax"
            :clickable="[]"
            :levels="frame.maxTree.levels"
            :no-scale="true"
          />
        </div>
        <div class="mid-col">
          <span class="row-label">中位数</span>
          <div class="median">{{ frame.median === null ? '∅' : frame.median }}</div>
          <div class="mid-arrow" title="中位数来自两个堆顶">↔</div>
        </div>
        <div class="tree-col">
          <span class="row-label">小顶堆（较大的一半）</span>
          <TreeCanvas
            :cells="frame.minTree.cells"
            :edges="frame.minTree.edges"
            :marks="frame.marksMin"
            :clickable="[]"
            :levels="frame.minTree.levels"
            :no-scale="true"
          />
        </div>
      </div>
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

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>流走完。</b>中位数 = <b>{{ frame.median }}</b> —— 大顶 [{{ frame.maxHeap.join('、') }}]（{{
        frame.maxHeap.length
      }} 个）、小顶 [{{ frame.minHeap.join('、') }}]（{{ frame.minHeap.length }} 个）：等长取两顶平均、不等取大顶顶，|大顶| − |小顶| 全程没出过 {0,1}。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>元素 <b>{{ Math.min(frame.cursor + 1, data.stream.length) }}</b> / {{ data.stream.length }}</span>
        <span class="dot">·</span>
        <span>大顶 <b>{{ frame.maxHeap.length }}</b> · 小顶 <b>{{ frame.minHeap.length }}</b></span>
        <span class="dot">·</span>
        <span>中位数 <b>{{ frame.median === null ? '∅' : frame.median }}</b></span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练「两个堆对着维护」。下面四题各多考一个东西，按顺序做。</p>
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
  color: #e8a9a9;
  border-color: #5c2828;
  background: #241212;
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
  flex-wrap: wrap;
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

.board {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
}

.tree-col {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.mid-col {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-bottom: 26px;
}

.row-label {
  font-size: 11.5px;
  color: var(--text-dim);
  letter-spacing: 0.4px;
}

.median {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  color: var(--text-strong);
  min-width: 72px;
  text-align: center;
}

.mid-arrow {
  font-size: 20px;
  color: var(--accent);
  line-height: 1;
  user-select: none;
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

.rel-diff--中 {
  color: #e3c07a;
  border-color: #574526;
}

.rel-diff--难 {
  color: #e8a9a9;
  border-color: #5c2828;
}

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
