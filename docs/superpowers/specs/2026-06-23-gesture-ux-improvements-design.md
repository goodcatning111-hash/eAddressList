# Gesture UX 优化设计文档

> 日期：2026-06-23 | 状态：待实现

## 目标

优化电子通讯录的三大手势交互体验：右划操作更跟手、长按反馈更明显、拖拽过程更流畅。

## 当前问题

| 手势 | 痛点 | 根因 |
|---|---|---|
| 右划编辑/删除 | 卡手，需要非常水平地滑动才能成功 | `friction=1.5` 偏重；对角滑动被 ScrollView 拦截 |
| 长按激活拖拽 | 等待久、反馈弱，不确定有没有按成功 | `delayLongPress=400ms`；仅 `opacity:0.85` 无缩放/震动 |
| 拖拽过程中 | 拖起来的卡片不够突出 | 仅 shadow 变化，无 scale 抬升效果 |
| 松手落地 | 落位无确认感 | 无回弹动画、无震动 |

## 设计方案

### 一、右划跟手性优化

**文件**：`src/components/ui/swipeable-row.tsx`

| 参数 | 旧值 | 新值 | 说明 |
|---|---|---|---|
| `friction` | 1.5 | 1.0 | 降低阻尼，滑动更轻快 |
| `rightThreshold` | 40 | 30 | 减少触发所需滑动距离 |
| `overshootFriction` | (默认) | 8 | 松手后微小回弹，不死硬 |

对角滑动容差：新增 `failOffsetY` 配置，允许 ±20px 垂直偏移时仍判定为横向滑动，避免被竖向滚动拦截。

### 二、长按反馈升级

**涉及文件**：
- `src/components/address-book-card.tsx`
- `src/components/directory-card.tsx`
- `src/components/ui/accordion-section.tsx`

**时间线**：

```
手指按住
  │
  ├─ 280ms ──→ scale 1.04 Spring 弹起 + haptic impactLight
  │
  └─ 开始拖拽 ──→ scale 1.03 保持 + 浮起阴影
                  │
                  └─ 松手 ──→ scale 1.0 Spring 回弹 + haptic impactLight
```

| 改动项 | 旧值 | 新值 |
|---|---|---|
| `delayLongPress` | 400ms | 280ms |
| 长按激活动画 | `opacity: 0.85` | `withSpring(1.04)` 缩放 + `impactLight` 震动 |
| 拖拽中 | shadow 变化 | scale(1.03) + elevation 8 |
| 落地 | 无 | `withSpring(1.0)` 回弹 + `impactLight` 震动 |

### 三、触觉反馈体系

安装 `expo-haptics`，在三处插入震动：

| 时机 | API | 感觉 |
|---|---|---|
| 长按激活（拖拽开始） | `Haptics.impactAsync('light')` | 轻轻"哒"一下 |
| 松手落地 | `Haptics.impactAsync('light')` | 轻轻"哒"一下 |
| 右划露出按钮（可选） | `Haptics.impactAsync('light')` | 确认操作触发 |

### 四、动画细节

所有缩放动画使用 Reanimated `withSpring`：

```typescript
// 长按激活时
scale.value = withSpring(1.04, {
  damping: 15,
  stiffness: 200,
});

// 拖拽中 (DraggableFlatList isActive)
// 在 renderItem 中检测 isActive，保持 scale 1.03

// 松手或取消时
scale.value = withSpring(1.0, {
  damping: 12,
  stiffness: 150,
});
```

## 涉及文件清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `src/components/ui/swipeable-row.tsx` | 参数调整 | friction, threshold, overshootFriction, failOffsetY |
| `src/components/address-book-card.tsx` | 动画+触觉 | Reanimated scale + haptic |
| `src/components/directory-card.tsx` | 动画+触觉 | 同上 |
| `src/components/ui/accordion-section.tsx` | 动画+触觉 | 同上 |
| `package.json` | 新增依赖 | expo-haptics |

## 不涉及

- 不改变 Swipeable 架构（仍使用 RNGH Swipeable 组件）
- 不改变 DraggableFlatList 核心逻辑
- 不改变数据流和业务逻辑
- 不改变路由和页面结构
