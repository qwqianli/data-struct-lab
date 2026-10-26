<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import HashCanvas from '../../../components/HashCanvas.vue'
import { buildFrames, checkPick, GROUP_A, GROUP_B } from './engine.js'

/**
 * 双状态模型（同 739/239）：picks 进 URL，viewIndex 管当前帧。
 * 一次查补数产出「定位 → 比对× → 结果（→ 存入）」多帧，逐帧用「继续」消费。
 */
const group = ref('A')
const nums = computed(() => (group.value === 'A' ? GROUP_A.nums : GROUP_B.nums))
const target = computed(() => (group.value === 'A' ? GROUP_A.target : GROUP_B.target))
const capacity = computed(() => (group.value === 'A' ? GROUP_A.capacity : GROUP_B.capacity))

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

const frames = computed(() =>
  buildFrames({ nums: nums.value, target: target.value, capacity: capacity.value, picks: picks.value }),
)
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && frame.value.decision !== null && !frame.value.done,
)

// 数组条：当前下标琥珀；已出答案的两个下标转绿
const marks = computed(() => {
  const f = frame.value
  const m = {}
  if (f.answer) {
    m[f.answer[0]] = 'ok'
    m[f.answer[1]] = 'ok'
  } else if (!f.done) {
    m[f.cursor] = 'active'
  }
  return m
})

// 从 URL 恢复进度时直接落在最新一帧（同前几关）
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
 * A/B 两组各埋一个坑：A 是官方数据（补数等于自己，先存后查会 [0,0]），
 * B 桶少、1 和 5 同桶，把「冲突 + 链」演出来。切换即清空进度。
 */
function switchGroup(next) {
  if (group.value === next) return
  group.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">哈希表 · 查找</div>
        <h2>两数之和 · 哈希表 <span class="pill pill--easy">1 · 易</span></h2>
        <p class="lede">
          边扫边查：拿到 x 就查补数 target − x。<b>先查还是先存由你定</b> —— 顺序错了，数会自己配上自己。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/two-sum/" target="_blank" rel="noreferrer">去刷原题 ↗</a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': group === 'A' }" @click="switchGroup('A')">
            A 顺序坑  [3,2,4] / 6
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': group === 'B' }" @click="switchGroup('B')">
            B 冲突可见  [1,5,3,6] / 9
          </button>
        </div>
        <span class="stage-side">上：数组（琥珀 = 当前）｜ 下：哈希表（{{ capacity }} 个桶）</span>
      </div>

      <div class="board">
        <ArrayCanvas :values="nums" :marks="marks" />
        <HashCanvas
          :capacity="capacity"
          :buckets="frame.buckets"
          :reserve-chain="group === 'A' ? 1 : 2"
          :query="frame.query"
        />
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': atDecision }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint"><span class="caret">▸</span>{{ frame.hint }}</p>
    </section>

    <div v-if="atDecision && frame.decision === 'order'" class="ask">
      <p class="ask-prompt">第一步的顺序：先查补数，还是先把自己存进表？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('lookup-first')">先查后存（拿 x 先查 target−x）</button>
        <button class="ask-btn" @click="onPick('store-first')">先存后查（先把 x 存进表）</button>
      </div>
    </div>
    <div v-else-if="atDecision && frame.decision === 'lookup'" class="ask">
      <p class="ask-prompt">补数 c = {{ frame.complement }} —— 查得到吗？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('hit')">查得到（hit，出答案）</button>
        <button class="ask-btn" @click="onPick('miss')">查不到（miss，存自己）</button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done && frame.answer" class="verdict verdict--ok">
      <b>答案 [{{ frame.answer.join(', ') }}]。</b>哈希表用一次 O(n) 的存换来了每一轮 O(1) 的查 —— 整体
      O(n)，比两层循环的 O(n²) 少一个数量级。
    </div>
    <div v-else-if="frame.done" class="verdict verdict--bad">
      <b>无解。</b>整个数组扫完，没有任何两个数的和等于 {{ target }}。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已处理 <b>{{ frame.cursor }}</b> / {{ nums.length }}</span>
        <span class="dot">·</span>
        <span>表里已存 <b>{{ frame.buckets.flat().length }}</b> 个</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「先查后存」。下面四题各多考一个东西，按顺序做。</p>
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
  flex: 1 1 220px;
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

.verdict--bad {
  background: #251717;
  border: 1px solid #55302e;
  color: #e8b0ac;
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
