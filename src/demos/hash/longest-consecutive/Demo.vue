<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import HashCanvas from '../../../components/HashCanvas.vue'
import { buildFrames, checkPick, DEFAULT_CAPACITY, DEFAULT_NUMS } from './engine.js'

/**
 * 双状态模型：阶段一自动建表（6 帧），阶段二每个数一次 start 决策、
 * 起点再接一次 count 决策（数段帧逐帧亮表内节点）。
 */
const nums = DEFAULT_NUMS
const capacity = DEFAULT_CAPACITY

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ nums, capacity, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && frame.value.decision !== null && !frame.value.done,
)

// 数组条：阶段一跟着存入下标走（帧 1..6 对应下标 0..5），阶段二跟着当前 n；终态把 best 段标绿
const marks = computed(() => {
  const f = frame.value
  const m = {}
  if (f.done && f.bestRange) {
    const [start, len] = f.bestRange
    for (let i = 0; i < len; i += 1) m[nums.indexOf(start + i)] = 'ok'
    return m
  }
  if (f.stage === 'build') {
    m[Math.max(Math.min(viewIndex.value, frames.value.length - 1) - 1, 0)] = 'active'
    return m
  }
  m[f.scanIndex] = 'active'
  return m
})

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
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">哈希表 · 集合</div>
        <h2>最长连续序列 · 哈希集合 <span class="pill pill--mid">128 · 中</span></h2>
        <p class="lede">
          找最长的连续整数段（如 1,2,3,4）。<b>每个数配不配当起点由你判</b> ——
          n−1 在表里，n 出发就是重复劳动。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/longest-consecutive-sequence/"
        target="_blank"
        rel="noreferrer"
      >
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <span class="stage-note">
          阶段一：全部数建进集合（自动）；阶段二：逐个判起点，起点再往上数
        </span>
        <span class="stage-side">best = {{ frame.best }}</span>
      </div>

      <div class="board">
        <ArrayCanvas :values="nums" :marks="marks" />
        <HashCanvas :capacity="capacity" :buckets="frame.buckets" :reserve-chain="2" :query="frame.query" />
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': atDecision }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint"><span class="caret">▸</span>{{ frame.hint }}</p>
    </section>

    <div v-if="atDecision && frame.decision === 'start'" class="ask">
      <p class="ask-prompt">{{ nums[frame.scanIndex] }} − 1 = {{ nums[frame.scanIndex] - 1 }}，它在表里吗？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('yes')">在（{{ nums[frame.scanIndex] }} 不是起点）</button>
        <button class="ask-btn" @click="onPick('no')">不在（它是起点）</button>
      </div>
    </div>
    <div v-else-if="atDecision && frame.decision === 'count'" class="ask">
      <p class="ask-prompt">从 {{ nums[frame.scanIndex] }} 往上连续数，能数出多长的段？</p>
      <div class="ask-options">
        <button v-for="len in 4" :key="len" class="ask-btn" @click="onPick(`count-${len}`)">
          {{ len }} 个
        </button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>最长连续序列长度 {{ frame.best }}。</b>判起点那一下，把 O(n²) 砍成了 O(n)：每个数只被「往上数」经过一次，因为它只在唯一的段起点出发时被数。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>阶段 <b>{{ frame.stage === 'build' ? '建表' : frame.stage === 'scan' ? '判起点' : '完成' }}</b></span>
        <span class="dot">·</span>
        <span>best <b>{{ frame.best }}</b></span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「n−1 在不在，n 才配当起点」。下面四题各多考一个东西，按顺序做。</p>
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
  background: #241c0e;
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
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.stage-note {
  font-size: 12px;
  color: var(--text-dim);
}

.stage-side {
  font-size: 12px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.board {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  flex: 1 1 160px;
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
