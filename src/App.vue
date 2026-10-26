<script setup>
import { computed, ref } from 'vue'
import { CATEGORIES, ALL_DEMOS, TOTAL_DEMOS, READY_DEMOS, leetcodeUrl } from './core/registry.js'

// 初始演示优先读 URL 的 demo 参数：?demo=reverse-list&picks=... 才是完整可分享的链接，
// 只认注册表里真实存在的 id，乱写的值一律回落到默认演示
const urlDemo = new URLSearchParams(window.location.search).get('demo')
const activeId = ref(ALL_DEMOS.some((d) => d.id === urlDemo) ? urlDemo : 'binary-search')

const active = computed(() => ALL_DEMOS.find((d) => d.id === activeId.value) ?? ALL_DEMOS[0])

// 写回地址栏时只动 demo 这一个键：picks 是各演示自己读的，
// 保留它才能「切到别的演示再切回来接着练」
function select(demo) {
  activeId.value = demo.id
  const url = new URL(window.location.href)
  url.searchParams.set('demo', demo.id)
  window.history.replaceState({}, '', url)
}

// 初始加载也同步一次，保证地址栏从一开始就带着 demo
select({ id: activeId.value })
</script>

<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <h1>数据结构实验室</h1>
        <p class="brand-sub">先自己想，再让动画证明</p>
      </div>

      <div class="progress">
        <div class="progress-bar">
          <span :style="{ width: `${(READY_DEMOS / TOTAL_DEMOS) * 100}%` }"></span>
        </div>
        <div class="progress-text">已可练习 <b>{{ READY_DEMOS }}</b> / {{ TOTAL_DEMOS }}</div>
      </div>

      <nav class="nav">
        <div v-for="cat in CATEGORIES" :key="cat.key" class="group">
          <div class="group-head">
            <span class="group-label">{{ cat.label }}</span>
            <span class="group-count">{{ cat.demos.filter((d) => d.status === 'ready').length }}/{{ cat.demos.length }}</span>
          </div>
          <ul>
            <li v-for="demo in cat.demos" :key="demo.id">
              <button
                class="item"
                :class="{ 'item--active': demo.id === activeId, 'item--planned': demo.status !== 'ready' }"
                @click="select(demo)"
              >
                <span class="item-no">{{ demo.no }}</span>
                <span class="item-title">{{ demo.title }}</span>
                <span v-if="demo.status !== 'ready'" class="item-tag">待做</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </aside>

    <main class="main">
      <component
        :is="active.component"
        v-if="active.status === 'ready'"
        :key="active.id"
        :related="active.related"
      />

      <div v-else class="placeholder">
        <div class="placeholder-crumb">{{ active.categoryLabel }} · 待做</div>
        <h2>{{ active.title }}</h2>
        <p class="placeholder-blurb">{{ active.blurb }}</p>
        <div class="placeholder-meta">
          <span>LeetCode {{ active.no }}</span>
          <span>难度 {{ active.difficulty }}</span>
          <a :href="leetcodeUrl(active)" target="_blank" rel="noreferrer">先去看原题 ↗</a>
        </div>
        <p class="placeholder-note">
          这个演示还没做。骨架、渲染器和「帧重放」模型已经跑通，接下来按分类逐个补引擎即可。
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  align-items: stretch;
}

.side {
  width: 252px;
  flex: none;
  border-right: 1px solid var(--line-soft);
  background: #0b1017;
  padding: 22px 14px 30px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.side::-webkit-scrollbar {
  width: 6px;
}

.side::-webkit-scrollbar-thumb {
  background: #1e2b3c;
  border-radius: 3px;
}

.brand {
  padding: 0 8px;
  margin-bottom: 16px;
}

.brand h1 {
  margin: 0 0 4px;
  font-size: 15.5px;
  font-weight: 650;
  color: var(--text-strong);
  letter-spacing: 0.3px;
}

.brand-sub {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-dim);
}

.progress {
  padding: 0 8px;
  margin-bottom: 20px;
}

.progress-bar {
  height: 3px;
  background: #1a2534;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 7px;
}

.progress-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #2f6fd0, #4d9bff);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.progress-text {
  font-size: 11.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.progress-text b {
  color: var(--text-strong);
}

.group {
  margin-bottom: 14px;
}

.group-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 8px 6px;
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 1.2px;
}

.group-count {
  font-size: 10.5px;
  color: #3f4f63;
  font-family: var(--font-mono);
}

.group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px 8px;
  margin-bottom: 1px;
  font-size: 12.5px;
  color: var(--text);
}

.item:hover {
  background: #131c28;
  border-color: transparent;
}

.item--active {
  background: #17273c;
  border-color: #27405e;
  color: var(--text-strong);
}

.item--planned {
  color: #4c5b6e;
}

.item--planned.item--active {
  color: var(--text);
}

.item-no {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: #40536b;
  min-width: 24px;
}

.item--active .item-no {
  color: var(--accent);
}

.item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-tag {
  font-size: 9.5px;
  color: #3f4f63;
  border: 1px solid #22303f;
  border-radius: 4px;
  padding: 0 4px;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 30px 40px 70px;
}

.placeholder {
  max-width: 620px;
  padding-top: 30px;
}

.placeholder-crumb {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.placeholder h2 {
  margin: 0 0 10px;
  font-size: 20px;
  color: var(--text-strong);
  font-weight: 650;
}

.placeholder-blurb {
  margin: 0 0 16px;
  color: var(--text);
  font-size: 13.5px;
}

.placeholder-meta {
  display: flex;
  gap: 18px;
  align-items: center;
  font-size: 12.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  margin-bottom: 24px;
}

.placeholder-meta a {
  color: var(--accent);
  text-decoration: none;
}

.placeholder-note {
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.8;
  border-left: 2px solid var(--line);
  padding-left: 13px;
  margin: 0;
}

@media (max-width: 780px) {
  .shell {
    display: block;
  }

  .side {
    width: 100%;
    height: auto;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--line-soft);
  }

  .main {
    padding: 22px 18px 60px;
  }
}
</style>
