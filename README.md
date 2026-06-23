# eAddressList 电子通讯录

跨平台企业内部通讯录 App，支持多通讯簿管理、二级目录手风琴、联系人搜索、拖拽排序、滑动操作、VCF/Excel 导入导出。

## 技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| Expo | SDK 56 | 跨平台框架 |
| React Native | 0.85.3 | UI 渲染 |
| expo-router | 56.2.11 | 文件系统路由 |
| expo-sqlite | 56.0.4 | SQLite 本地数据库 |
| react-native-gesture-handler | 2.31.1 | 手势系统（Swipeable / DraggableFlatList） |
| react-native-reanimated | 4.3.1 | 动画引擎 |
| react-native-draggable-flatlist | latest | 拖拽排序 |
| xlsx (SheetJS) | 0.18.5 | Excel/CSV 解析与生成 |

## 快速开始

```bash
npm install
npx expo start
```

然后按 `a` 打开 Android 模拟器，或扫码在 Expo Go 中运行。

## 功能特性

- **多通讯簿**：创建、重命名、拖拽排序、10 色主题切换
- **二级目录**：一级目录列表 → 二级手风琴折叠 → 联系人详情
- **编辑模式**：🔒/🔓 切换，长按拖拽排序，右划编辑/删除
- **全局搜索**：跨所有通讯簿模糊搜索（6 字段匹配，忽略全角/半角空格）
- **收藏联系人**：详情页 ⭐ 一键收藏，首页独立入口查看
- **主题色系统**：通讯簿、目录、联系人头像均可自定义 Morris 10 色
- **导入导出**：支持 xlsx / xls / et / csv / JSON 格式

## 项目结构

```
src/
├── app/                    # expo-router 页面
│   ├── _layout.tsx         # 根布局
│   ├── index.tsx           # 通讯簿门户
│   ├── search.tsx          # 全局搜索
│   ├── favorites.tsx       # 收藏联系人
│   ├── settings.tsx        # 导入/导出 + 清理重复
│   └── book/[id]/          # 通讯簿内页面
│       ├── index.tsx       # 一级目录
│       ├── [level1]/index.tsx  # 二级手风琴
│       └── contact/        # 联系人 CRUD
├── components/
│   ├── ui/
│   │   ├── swipeable-row.tsx    # UnifiedSwipeableWrapper
│   │   └── accordion-section.tsx
│   ├── address-book-card.tsx
│   ├── directory-card.tsx
│   ├── contact-row.tsx
│   └── contact-form.tsx
├── db/
│   ├── schema.ts
│   ├── database.ts
│   ├── types.ts
│   └── dao/
├── constants/
│   ├── colors.ts           # Morris 10 色板
│   └── theme.ts
├── hooks/
└── utils/
    └── import-export.ts
```

## 文档

- [`API_REFERENCE.md`](./API_REFERENCE.md) — 数据库 DAO、页面组件、工具函数 API
- [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md) — 数据模型、路由架构、设计决策
