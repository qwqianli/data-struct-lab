<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import HashCanvas from '../../../components/HashCanvas.vue'
import { buildFrames, checkPick, DEFAULT_CAPACITY, DEFAULT_WORDS, signatureChoices } from './engine.js'

/**
 * 双状态模型：签名决策（第 1 词）+ 每词一次 lookup 决策，
 * 查签名逐帧产出「定位 → 比对× → 并入/建组」。
 */
const words = DEFAULT_WORDS
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

const frames = computed(() => buildFrames({ words, capacity, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && frame.value.decision !== null && !frame.value.done,
)

const marks = computed(() => {
  const f = frame.value
  const m = {}
  if (!f.done) m[f.cursor] = 'active'
  return m
})

const sigChoices = computed(() => signatureChoices(words[0]))

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
        <div class="crumb">哈希表 · 映射</div>
        <h2>字母异位词分组 · 哈希映射 <span class="pill pill--mid">49 · 中</span></h2>
        <p class="lede">
          把「字母相同、顺序不同」的单词归成组。<b>每个词的签名查得到吗由你判</b> ——
          同一个桶不等于同一个 key，链要挨个比。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/group-anagrams/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <span class="stage-note">上：单词（琥珀 = 当前）｜ 中：哈希表（key = 签名，value = 计数）</span>
        <span class="stage-side">已分 {{ frame.groups.length }} 组</span>
      </div>

      <div class="board">
        <ArrayCanvas :values="words" :marks="marks" />
        <HashCanvas :capacity="capacity" :buckets="frame.buckets" :reserve-chain="2" :query="frame.query" />
      </div>

      <div class="groups">
        <span class="row-label">分组</span>
        <div class="group-list">
          <span v-for="(g, gi) in frame.groups" :key="gi" class="group">
            [ {{ g.join(', ') }} ]
          </span>
        </div>
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': atDecision }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint"><span class="caret">▸</span>{{ frame.hint }}</p>
    </section>

    <div v-if="atDecision && frame.decision === 'signature'" class="ask">
      <p class="ask-prompt">{{ words[0] }} 的签名（分组的 key）是哪个？</p>
      <div class="ask-options">
        <button
          v-for="choice in sigChoices"
          :key="choice"
          class="ask-btn ask-btn--mono"
          @click="onPick(`sig-${choice}`)"
        >
          {{ choice }}
        </button>
      </div>
    </div>
    <div v-else-if="atDecision && frame.decision === 'lookup'" class="ask">
      <p class="ask-prompt">签名 {{ frame.signature }} —— 查得到吗？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('hit')">查得到（hit，并入这组）</button>
        <button class="ask-btn" @click="onPick('miss')">查不到（miss，建新组）</button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>{{ frame.groups.length }} 组。</b>hash('eat') 和 hash('aet') 一样 —— 字符码加法跟顺序无关；但 key 不一样。哈希一样只说明「可能同桶」，key 相等才能确认「同一个」。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已处理 <b>{{ frame.cursor }}</b> / {{ words.length }} 词</span>
        <span class="dot">·</span>
        <span>已分 <b>{{ frame.groups.length }}</b> 组</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「签名当 key、链上比 key」。下面四题各多考一个东西，按顺序做。</p>
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

.groups {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-top: 16px;
}

.row-label {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
}

.group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 分组结果是普通 HTML 列表（不是 SVG）：随帧增长，直接可读 */
.group {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ok);
  border: 1px solid #1f5138;
  background: #0f2519;
  border-radius: 7px;
  padding: 3px 10px;
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
  flex: 1 1 200px;
  text-align: left;
  padding: 9px 14px;
}

.ask-btn--mono {
  font-family: var(--font-mono);
  text-align: center;
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
