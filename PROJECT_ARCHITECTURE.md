# eAddressList 项目架构文档

> 最后更新：2026-06-23

## 技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| Expo | SDK 56 | 跨平台框架 |
| React Native | 0.85.3 | UI 渲染 |
| expo-router | 56.2.11 | 文件系统路由（Stack 导航） |
| expo-sqlite | 56.0.4 | SQLite 本地数据库 |
| expo-file-system/legacy | 56.0.7 | 文件读写（导出用） |
| expo-document-picker | 56.0.4 | 文件选择器 |
| expo-sharing | 56.0.16 | 系统分享 |
| expo-clipboard | 56.0.3 | 剪贴板 |
| expo-linking | 56.0.14 | 拨号 |
| react-native-gesture-handler | 2.31.1 | 手势系统（Swipeable / DraggableFlatList） |
| react-native-reanimated | 4.3.1 | 动画引擎 |
| react-native-draggable-flatlist | latest | 拖拽排序列表 |
| expo-haptics | ~56.0.3 | 长按触觉反馈 |
| xlsx (SheetJS) | 0.18.5 | Excel/CSV 解析与生成 |

## 目录结构

```
eAddressList/
├── app.json
├── package.json
├── assets/
│   └── images/                 # 图标资源
├── src/
│   ├── app/                    # expo-router 页面
│   │   ├── _layout.tsx         # 根布局：GestureHandlerRootView + Stack
│   │   ├── index.tsx           # 通讯簿门户（含编辑模式）
│   │   ├── search.tsx          # 全局搜索
│   │   ├── settings.tsx        # 导入/导出
│   │   └── book/[id]/          # 通讯簿内页面
│   │       ├── index.tsx       # 一级目录列表
│   │       ├── search.tsx      # 通讯簿内搜索
│   │       ├── [level1]/
│   │       │   └── index.tsx   # 二级目录手风琴+联系人
│   │       └── contact/
│   │           ├── new.tsx     # 新建联系人
│   │           └── [contactId]/
│   │               ├── index.tsx  # 联系人详情
│   │               └── edit.tsx   # 编辑联系人
│   ├── components/
│   │   ├── address-book-card.tsx
│   │   ├── directory-card.tsx
│   │   ├── contact-row.tsx
│   │   ├── contact-form.tsx
│   │   ├── phone-row.tsx
│   │   └── ui/
│   │       ├── accordion-section.tsx
│   │       ├── swipeable-row.tsx    # UnifiedSwipeableWrapper 统一右划容器
│   │       └── collapsible.tsx
│   │   └── SwipeableContactCard.jsx  # 滑动组件参考实现（设计原型）
│   ├── constants/
│   │   ├── theme.ts
│   │   └── colors.ts              # Morris 色板 + 工具函数
│   ├── db/
│   │   ├── types.ts
│   │   ├── schema.ts
│   │   ├── database.ts
│   │   └── dao/
│   │       ├── address-book-dao.ts
│   │       ├── contact-dao.ts
│   │       └── directory-dao.ts
│   ├── hooks/                    # useColorScheme, useTheme, useHapticScale
│   └── utils/
│       └── import-export.ts      # fetch() 方式导入导出
```

## 数据模型

```
┌──────────────────────────────────┐
│         address_books            │
├──────────────────────────────────┤
│ id (PK)        INTEGER           │
│ name           TEXT              │
│ sort_order     INTEGER DEFAULT 0 │
│ color_index    INTEGER DEFAULT -1│  ← -1=用id决定, ≥0=自定义
│ created_at     INTEGER           │
│ updated_at     INTEGER           │
└────────┬─────────────────────────┘
         │ 1:N (CASCADE)
┌────────▼─────────────────────────┐
│           contacts                │
├──────────────────────────────────┤
│ id (PK)         INTEGER          │
│ address_book_id INTEGER (FK)     │
│ level1_dir      TEXT             │
│ level2_dir      TEXT             │
│ name            TEXT             │
│ position        TEXT (nullable)  │
│ office_phone    TEXT (nullable)  │
│ mobile_phones   TEXT             │  ← 逗号分隔
│ color_index     INTEGER DEFAULT -1│  ← -1=姓名取色, ≥0=自定义头像色
│ is_favorite     INTEGER DEFAULT 0│  ← 0=未收藏, 1=已收藏
│ created_at      INTEGER          │
│ updated_at      INTEGER          │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│        directory_order           │
├──────────────────────────────────┤
│ id (PK)         INTEGER          │
│ address_book_id INTEGER (FK)     │
│ level           INTEGER          │  ← 1 or 2
│ parent_dir      TEXT DEFAULT ''  │  ← level2时填level1名
│ dir_name        TEXT             │
│ sort_order      INTEGER DEFAULT 0│
│ color_index     INTEGER DEFAULT -1│  ← -1=名称哈希, ≥0=自定义卡片色
└──────────────────────────────────┘
```

## 路由架构

```
/                                    → 通讯簿门户（首页）
/search                              → 全局搜索
/settings                            → 导入/导出设置
/book/[id]                           → 一级目录列表
/book/[id]/search                    → 通讯簿内搜索 (modal)
/book/[id]/[level1]                  → 二级目录手风琴+联系人
/book/[id]/contact/[contactId]       → 联系人详情
/book/[id]/contact/[contactId]/edit  → 编辑联系人 (modal)
/book/[id]/contact/new               → 新建联系人 (modal, ?l1=&l2=)
/favorites                            → 收藏联系人列表
```

## 页面流转

```
[通讯簿门户]
  ├── 点击卡片 → [一级目录]
  │                ├── 点击 → [二级目录+手风琴]
  │                │           ├── 展开 → 联系人列表 → 点击 → [详情]
  │                │           │                          ├── 📞 拨号
  │                │           │                          ├── 📋 复制
  │                │           │                          └── ✎ → [编辑]
  │                │           └── ＋ → [新建联系人(预填目录)]
  │                ├── 🔍 → [搜索]
  │                └── ＋ → 新建一级目录 or 新建联系人
  ├── 🔍 → [全局搜索]
  ├── ⭐ → [收藏联系人] → 点击 → [详情]
  ├── 🔒 → 编辑模式：长按拖拽 / 右划编辑删除
  └── ⚙ → [设置] → 导入/导出
```

## 交互系统

### 编辑模式
1. 每层页面 header 有 **🔒编辑 / 🔓完成** 切换
2. 默认锁闭：点击进入下级
3. 解锁后启用：
   - **长按卡片** → 震动反馈 + 拖拽排序（280ms 延迟、expo-haptics、DraggableFlatList）
   - **右划卡片** → 露出"编辑""删除"按钮（UnifiedSwipeableWrapper：轻快滑动 friction=1 + 对角容差 failOffsetY=[-20,20] + 等高同步 + 双向锁死越界）
   - **点击** → 手风琴展开（二级目录）
4. 所有删除需输入名称确认

### 颜色系统

所有卡片/头像统一使用 Morris 10 色板，每个色点有 bg（背景）和 fg（前景字色）。

**规则：`color_index ≥ 0` → 自定义色；`-1` → 回退默认算法。**

| 实体 | 存储列 | 自定义色 | 默认算法 |
|---|---|---|---|
| 通讯簿 | `address_books.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(id)` |
| 一级目录 | `directory_order.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(hashIndex(name))` |
| 二级目录 | `directory_order.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(hashIndex(name))` |
| 联系人头像 | `contacts.color_index` | `getMorrisColor(colorIndex)` | `getNameColor(name)` |

编辑对话框均提供 10 色 Morri 色板 + ↺ 恢复默认按钮。

### 搜索系统
- 6 字段模糊匹配：姓名、职务、一级目录、二级目录、手机号、办公电话
- 忽略半角/全角空格（SQL REPLACE + 查询词去空白）
- `dedupContacts` 应用层去重——所有关键字段先去掉空格再比对
- 全局搜索 JOIN address_books 返回通讯簿名，按通讯簿分组展示

## 设计决策

| 决策 | 理由 |
|---|---|
| 目录不建独立表 | 减少 schema 复杂度，通过 contacts 聚合查询 |
| directory_order 独立表 | 目录排序需持久化，直接存 contacts 太重量 |
| 导入用 fetch()+ArrayBuffer | 避免 expo-file-system base64 编码问题 |
| 颜色用名称哈希 | 目录拖拽后颜色跟随内容而非位置 |
| 手势用 DraggableFlatList+Swipeable | 组合手势实现长按拖拽+右划操作 |
| 右划参数调优 | friction=1 threshold=30 failOffsetY=[-20,20]：降低阻尼、放宽角度容差、缩短触发距离 |
| 长按震动反馈 | expo-haptics impactLight，280ms 延迟，在所有卡片组件中统一使用 useHapticScale |
| 搜索 SQL REPLACE 处理空格 | 彻底解决半角/全角空格匹配问题 |
