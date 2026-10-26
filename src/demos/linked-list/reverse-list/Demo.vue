<script setup>
import { computed, ref } from 'vue'
import ListCanvas from '../../../components/ListCanvas.vue'
import { buildFrames, checkPick, DEFAULT_VALUES } from './engine.js'

/**
 * 交互模型和二分查找有一处关键不同：那边每轮只有 1 帧，picks 一变就直接显示最后一帧；
 * 这边每轮会自动补出 3 帧（存 next → 改箭头 → 挪指针），用户要逐帧看，
 * 所以多了一个纯展示状态 viewIndex —— 它只管「当前看到第几帧」，不进 URL。
 * picks 仍然是唯一的进度状态：撤销 = 弹栈、重来 = 清空、?picks= 能复现任意进度。
 */
const values = DEFAULT_VALUES

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
// —— 否则 registry 引组件、组件再引 registry，就绕成循环依赖了
defineProps({
  related: { type: Array, default: () => [] },
})

// 动作名是字符串，直接从 URL 读进来就能用；非法值交给 buildFrames 静默跳过
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ values, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const reversedCount = computed(() => frame.value.links.filter((l) => l.kind === 'reversed').length)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)

// 从 URL 恢复进度时直接落在最新一帧：分享出去的链接第一眼就是当前状态，不用从第 0 帧翻起
viewIndex.value = frames.value.length - 1

function onPick(action) {
  const result = checkPick(frame.value, action)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length // 新增的 3 帧从「当前提问帧 + 1」开始
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
        <div class="crumb">链表 · 反转</div>
        <h2>反转链表 <span class="pill pill--easy">206 · 易</span></h2>
        <p class="lede">
          把每个节点的箭头掉个头。<b>每一轮的第一步由你选</b>：三个动作里只有一个能先做，选错会告诉你错在哪。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/reverse-linked-list/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <span class="stage-note">每一轮固定三步：<b>存 next</b> → <b>改箭头</b> → <b>挪指针</b></span>
        <span class="stage-side">节点不动，只有箭头掉头</span>
      </div>
      <ListCanvas
        :nodes="frame.nodes"
        :links="frame.links"
        :pointers="frame.pointers"
        :highlights="frame.highlights"
      />
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
        <button v-for="opt in frame.ask.options" :key="opt.action" class="ask-btn" @click="onPick(opt.action)">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>反转完成。</b>{{ values.length }} 轮走完，画布里绿色的边就是被改过的箭头 —— 一共
      {{ reversedCount }} 条。prev 现在指向新的头节点。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已完成 <b>{{ frame.round }}</b> / {{ values.length }} 轮</span>
        <span class="dot">·</span>
        <span>掉头 <b>{{ reversedCount }}</b> 条</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「箭头掉头」。下面四题各多考一个东西，按顺序做。</p>
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
  padding: 18px 20px 10px;
  margin-bottom: 16px;
}

.stage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.stage-note {
  font-size: 12px;
  color: var(--text-dim);
}

.stage-note b {
  color: var(--text);
  font-weight: 600;
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
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
