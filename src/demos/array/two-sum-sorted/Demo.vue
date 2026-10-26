<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_NUMBERS, DEFAULT_TARGET } from './engine.js'

/**
 * 交互模型沿用二分查找的单帧结构：每轮只有 1 帧，
 * picks 一变直接显示最后一帧，不需要 viewIndex。
 * 决策不用点击格子（格子没有「该点哪个」的语义），用两个方向按钮。
 */
const numbers = DEFAULT_NUMBERS
const target = DEFAULT_TARGET

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

// picks 是 'left' / 'right' 的序列，?picks=right,right 可复现任意一次练习
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const feedback = ref('')

const frames = computed(() => buildFrames({ numbers, target, picks: picks.value }))
const frame = computed(() => frames.value[frames.value.length - 1])
const playing = computed(() => !frame.value.found && !frame.value.dead)

// 这行算式是本演示全部推理的依据，必须一直在视野里，让学习者随时能自己验算
const sumLine = computed(() => {
  const f = frame.value
  if (f.dead) return '区间已空：left 追上了 right'
  return `numbers[${f.left}] + numbers[${f.right}] = ${f.numbers[f.left]} + ${f.numbers[f.right]} = ${f.sum}`
})

// 命中时两个指针位置转绿（「绿色 = 找到答案」与二分查找统一）；平时琥珀表示「正在比较」
const marks = computed(() => {
  const f = frame.value
  const state = f.found ? 'ok' : 'active'
  return { [f.left]: state, [f.right]: state }
})
const candidates = computed(() => frame.value.right - frame.value.left + 1)

function onPick(direction) {
  const result = checkPick(frame.value, direction)
  if (result.ok) {
    picks.value.push(direction)
    feedback.value = ''
  } else {
    feedback.value = result.message
  }
}

function undo() {
  if (picks.value.length) {
    picks.value.pop()
    feedback.value = ''
  }
}

function reset() {
  picks.value = []
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">数组 · 双指针</div>
        <h2>双指针 · 两数之和 II <span class="pill pill--mid">167 · 中</span></h2>
        <p class="lede">
          升序数组里找两个数，和等于目标。<b>每一步该动哪边由你选</b> —— 答错会告诉你为什么只有那一个方向是对的。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/two-sum-ii-input-array-is-sorted/"
        target="_blank"
        rel="noreferrer"
      >
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="target-row">
        <span class="sum-line">{{ sumLine }}</span>
        <span class="target-chip">目标 {{ target }}</span>
      </div>
      <ArrayCanvas
        :values="numbers"
        :pointers="[
          { name: 'left',  at: frame.left },
          { name: 'right', at: frame.right },
        ]"
        :eliminated="frame.eliminated"
        :marks="marks"
      />
    </section>

    <section class="say" :class="{ 'say--ask': playing }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <div v-if="playing" class="ask">
      <p class="ask-prompt">和 {{ frame.sum }} {{ frame.sum > target ? '>' : '<' }} 目标 {{ target }} —— 该动哪边？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('left')">把 left 往右移</button>
        <button class="ask-btn" @click="onPick('right')">把 right 往左移</button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.found" class="verdict verdict--ok">
      <b>命中。</b>numbers[{{ frame.left }}] + numbers[{{ frame.right }}] =
      {{ frame.numbers[frame.left] }} + {{ frame.numbers[frame.right] }} = {{ frame.sum }}，正好等于目标
      {{ target }}。
    </div>
    <div v-else-if="frame.dead" class="verdict verdict--bad">
      <b>无解。</b>两头夹到区间压空也没凑出 {{ target }} —— 夹逼同样能证明「不存在」。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>已决策 <b>{{ frame.picksCount }}</b> 次</span>
        <span class="dot">·</span>
        <span>已排除 <b>{{ frame.eliminated.length }}</b> 个</span>
        <span class="dot">·</span>
        <span>剩余候选 <b>{{ candidates }}</b> 个</span>
      </div>
      <div class="actions">
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button class="primary" :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「大了收右、小了进左」。下面四题各多考一个东西，按顺序做。</p>
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
  padding: 18px 20px 10px;
  margin-bottom: 16px;
}

.target-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.sum-line {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.target-chip {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--warn);
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
