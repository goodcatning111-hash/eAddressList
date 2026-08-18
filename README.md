# 📖 eAddressList 电子通讯录

> 轻量、优雅的企业内部通讯录管理 App，专为组织架构清晰的中小型团队设计。

基于 **Expo SDK 56** + **React Native** 构建，纯本地 SQLite 存储，无需后端服务，开箱即用。

---

## ✨ 功能一览

| | | |
|---|---|---|
| 📚 **多通讯簿管理** | 创建多个独立通讯簿，拖拽排序，10 色主题自由切换 |
| 📂 **二级目录系统** | 一级目录 → 二级手风琴折叠 → 联系人详情，贴合企业组织架构 |
| ✏️ **编辑模式** | 🔒 一键解锁：长按拖拽排序（含震动反馈）、右划露出编辑/删除按钮 |
| 🔍 **智能搜索** | 跨通讯簿全局搜索，6 字段模糊匹配，按通讯簿分组展示 |
| ⭐ **收藏联系人** | 详情页一键收藏，独立收藏页集中查看 |
| 🎨 **个性化配色** | 通讯簿、一/二级目录、联系人头像均支持自定义 Morris 10 色 |
| 💾 **存档 & 读档** | 6 个本地存档位，完整保存排序、颜色、收藏状态 |
| 📥 **多格式导入** | xlsx · xls · CSV · JSON — 自动检测表头，兼容空字段、重排列与合并目录单元格 |
| 📤 **灵活导出** | JSON（选通讯簿 + 含/无样式）、Excel（选通讯簿导出全量数据） |
| 📋 **模板下载** | 一键生成标准导入模板，按格式填写即可批量导入 |
| 🧹 **自动清理** | 导入、删除后自动清理重复与冗余数据 |
| 📌 **吸顶表头** | 二级目录展开后表头自动锁定，滚动至末尾自动释放 |

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 验证通讯录表格解析
npm run test:import
```

按 `a` 打开 Android 模拟器，或使用 **Expo Go** 扫码即用。

---

## 🏗️ 技术栈

| 技术 | 用途 |
|---|---|
| [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/) | 跨平台框架 |
| React Native 0.85.3 / React 19 | UI 渲染引擎 |
| expo-router | 文件系统路由（Stack 导航） |
| expo-sqlite | 本地 SQLite 数据库 |
| react-native-gesture-handler | 手势交互（右划操作、长按拖拽） |
| react-native-reanimated | 动画引擎（Keyframe / FadeIn / 启动动画） |
| react-native-draggable-flatlist | 拖拽排序列表 |
| expo-haptics | 触觉反馈（长按震动） |
| expo-system-ui | 系统背景色控制 |
| expo-image / expo-symbols | 高性能图片 + SF Symbols 图标 |
| @expo/vector-icons | MaterialIcons 图标库 |
| @react-native-async-storage/async-storage | 键值持久化（主题偏好） |
| SheetJS (xlsx) | Excel / CSV 解析与模板生成 |
| expo-file-system | 存档文件读写 |
| expo-sharing / expo-document-picker | 系统分享 / 文件选择 |
| expo-splash-screen | 启动画面 |

---

## 📁 项目结构

```
src/
├── app/                        # 路由页面（10 routes）
│   ├── _layout.tsx             #   根布局（GestureHandlerRootView + 双层 ThemeProvider + Stack）
│   ├── index.tsx               #   通讯簿门户
│   ├── search.tsx              #   全局搜索
│   ├── favorites.tsx           #   收藏联系人
│   ├── settings.tsx            #   设置（存档/读档/导入/导出）
│   └── book/[id]/              #   通讯簿内子页面
│       ├── index.tsx           #     一级目录
│       ├── search.tsx          #     通讯簿内搜索 (modal)
│       ├── [level1]/index.tsx  #     二级手风琴
│       └── contact/            #     联系人 CRUD + 详情
├── components/
│   ├── ui/
│   │   ├── swipeable-row.tsx   #   UnifiedSwipeableWrapper
│   │   ├── accordion-section.tsx
│   │   └── collapsible.tsx     #   Collapsible 可折叠面板
│   ├── themed-text.tsx         #   ThemedText 主题文本
│   ├── themed-view.tsx         #   ThemedView 主题容器
│   ├── icon.tsx                #   Icon MaterialIcons 封装
│   ├── animated-icon.tsx       #   AnimatedSplashOverlay 启动动画
│   ├── SwipeableContactCard.jsx  # 滑动组件设计原型
│   ├── address-book-card.tsx
│   ├── directory-card.tsx
│   ├── contact-row.tsx
│   ├── contact-form.tsx
│   └── phone-row.tsx
├── contexts/
│   └── theme.tsx               #   ThemeProvider + useTheme + useAppTheme
├── db/
│   ├── schema.ts               #   建表 + 列迁移
│   ├── database.ts
│   ├── types.ts
│   └── dao/                    #   数据访问层
├── constants/
│   ├── colors.ts               #   Morris 10 色板
│   └── theme.ts
├── hooks/
│   ├── use-color-scheme.ts     #   系统配色检测
│   ├── use-theme.ts            #   组件级主题取色
│   └── use-haptic-scale.ts     #   长按震动反馈
└── utils/
    ├── contact-import-parser.ts #  纯函数表头识别与行解析
    ├── import-export.ts        #   文件读取 / 导出 / 模板生成
    └── save-manager.ts         #   6 槽位存档管理
```

---

## 📖 文档

- [`API_REFERENCE.md`](./API_REFERENCE.md) — 完整 API 参考（DAO、页面组件、工具函数）
- [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md) — 数据模型、路由架构、设计决策

---

<p align="center"><sub>Built with ❤️ using Expo & React Native</sub></p>
