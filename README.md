# 数据结构实验室

把 LeetCode 精选训练题拆成「**先自己决策、再看动画证明**」的练习场。

和 visualgo 的区别只有一个，但是关键的一个：**关键的那一步不替你算**。
二分查找里中点由你算出、由你点击；点错会告诉你错在上中点、区间外，还是算错了。

## 跑起来

```bash
npm install
npm run dev          # http://localhost:5180
```

> ⚠️ 本机 Vite 只监听 IPv6 回环，`127.0.0.1:5180` 连不上，用 `localhost`。

## 自检

```bash
npm run selftest     # 引擎纯函数的帧序列断言，零依赖
npm run build        # 生产构建
```

## 当前进度

**11 / 22 个演示可用。** 4 个渲染器（Array / List / Stack / Hash）+ 11 个演示（704 / 167 / 206 / 141 / 21 / 20 / 739 / 239 / 1 / 49 / 128）。

## 目录

```
src/
├─ App.vue                 左侧 22 个演示的目录 + 右侧演示区
├─ core/registry.js        22 个演示的唯一事实来源（链接经题库接口校验）
├─ components/
│  ├─ ArrayCanvas.vue      SVG 数组渲染器，key 绑元素身份，位置走 CSS transform
│  ├─ ListCanvas.vue       链表渲染器（节点 + next 箭头，支持多行）
│  ├─ StackCanvas.vue      竖直栈渲染器（支持 sub 辅助结构）
│  └─ HashCanvas.vue       哈希桶 + 冲突链渲染器
├─ demos/                  每个演示 = engine.js（纯函数 buildFrames）+ Demo.vue
│  ├─ array/               二分查找（704）、两数之和 II（167）
│  ├─ linked-list/         反转链表（206）、环形链表（141）、合并有序链表（21）
│  ├─ stack/               有效括号（20）、每日温度（739）
│  ├─ queue/               滑动窗口最大值（239）
│  └─ hash/                两数之和（1）、字母异位词分组（49）、最长连续序列（128）
└─ styles/theme.css        深色主题变量
scripts/selftest.mjs       引擎自检
```

## 两个不要改的设计

1. **引擎必须是纯函数**：`buildFrames({初始数据, picks})`，不维护游标。
   撤销 = `picks.pop()`，复现 = URL 带 `?picks=4,7`，单测 = 直接断言帧序列。
2. **渲染循环的 key 绑元素身份（`ids`），不绑下标**。
   绑下标的话，交换位置会退化成「原地换色」，CSS transition 就没意义了。
