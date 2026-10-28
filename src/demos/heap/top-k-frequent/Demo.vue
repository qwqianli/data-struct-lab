<script setup>
import { computed, ref } from 'vue'
import TreeCanvas from '../../../components/TreeCanvas.vue'
import HashCanvas from '../../../components/HashCanvas.vue'
import { buildFrames, checkPick, DEFAULT_DATA, FIXTURE_A, FIXTURE_B } from './engine.js'

/**
 * 双状态模型（同前六题）：picks 是唯一进度状态（进 URL），viewIndex 只管看到第几帧。
 * 两个画布：左 HashCanvas（频率表，全程在场）、右 TreeCanvas（按频率的小顶堆）。
 * 本题前两帧是「无决策」的展示帧（f0 数组 → f1 频率表 + 第一问）：
 * picks 为空时落在 f0，按「继续」揭示统计帧 —— 频率是 1 帧给全的，不让用户一个个数。
 *
 * 数据集不进 URL，两组按全序列复放判定（哪组把整份 picks 吃到 done 就落哪组，都不中回落 A）。
 */
function resolveData(picks) {
  if (!picks.length) return DEFAULT_DATA
  for (const data of [FIXTURE_A, FIXTURE_B]) {
    if (buildFrames({ nums: data.nums, k: data.k, picks }).at(-1).done) return data
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

const frames = computed(() => buildFrames({ nums: data.value.nums, k: data.value.k, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)

// 决策只发生在最后一帧的 ask 上；堆画布不可点（决策是选操作）
const atDecision = computed(() => viewIndex.value === frames.value.length - 1 && frame.value.ask !== null)

// 不同值个数（统计行的分母）
const distinctCount = computed(() => new Set(data.value.nums).size)

// 有进度落最新（深链第一眼是当前状态）；零进度落 f0（先看数组，按「继续」揭示频率表）
viewIndex.value = picks.value.length ? frames.value.length - 1 : 0

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
  viewIndex.value = picks.value.length ? frames.value.length - 1 : 0
}

function reset() {
  picks.value = []
  feedback.value = ''
  viewIndex.value = 0
}

/** A 考「满堆后的三分支」（换顶 + 丢弃）；B 是 3 值小样本（纯入堆 + 一次换顶）。切换即清空进度。 */
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
        <div class="crumb">堆 · 前 K 高频</div>
        <h2>前 K 个高频元素 <span class="pill pill--mid">347 · 中</span></h2>
        <p class="lede">
          排序不是必须的。左边哈希表<b>一次数完全部频率</b>，右边大小 {{ data.k }} 的小顶堆按频率筛选：<b
            >入堆 / 换顶 / 丢弃由你判断</b>，走完堆里就是频率最高的 {{ data.k }} 个。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/top-k-frequent-elements/"
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
            十二元素 k=3&nbsp;&nbsp;[1,1,1,2,2,3,4,5,5,5,5,5]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            六元素 k=2&nbsp;&nbsp;[1,1,2,3,3,3]
          </button>
        </div>
        <span class="stage-side">左：频率表（桶号 = 值 % 桶数） · 右：按频率的小顶堆</span>
      </div>

      <div class="board">
        <div class="hash-col">
          <span class="row-label">频率表</span>
          <HashCanvas :capacity="frame.hash.capacity" :buckets="frame.hash.buckets" :reserve-chain="1" />
        </div>
        <div class="heap-col">
          <span class="row-label">小顶堆（键 = 频率）</span>
          <TreeCanvas
            :cells="frame.cells"
            :edges="frame.edges"
            :pointers="frame.pointers"
            :marks="frame.marks"
            :clickable="[]"
            :levels="frame.levels"
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

    <div v-if="frame.done && frame.answer && frame.answer.length" class="verdict verdict--ok">
      <b>走完。</b>前 {{ data.k }} 高频 = <b>[{{ frame.answer.join('、') }}]</b> —— 堆里留着频率最高的
      {{ frame.heap.length }} 个，堆顶 {{ frame.heap[0].v }}（{{ frame.heap[0].f }} 次）就是第 {{ data.k }}
      高的频率。全程没有排序。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>值 <b>{{ Math.min(frame.cursor + 1, distinctCount) }}</b> / {{ distinctCount }}</span>
        <span class="dot">·</span>
        <span>堆 <b>{{ frame.heap.length }}</b> / {{ data.k }}</span>
        <span class="dot">·</span>
        <span v-if="frame.heap.length">堆顶 {{ frame.heap[0].v }}（{{ frame.heap[0].f }} 次）</span>
        <span v-else>堆还是空的</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练「比较键从数值换成频率」。下面四题各多考一个东西，按顺序做。</p>
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
  align-items: flex-start;
  gap: 20px;
}

.hash-col {
  flex: none;
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.heap-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
