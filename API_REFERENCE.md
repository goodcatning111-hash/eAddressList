# eAddressList API & 函数参考文档

> 最后更新：2026-07-01

## 数据库层 (`src/db/`)

### database.ts — 数据库连接管理

#### `getDatabase(): Promise<SQLiteDatabase>`
获取 SQLite 数据库单例。首次调用时自动创建数据库并执行建表+迁移。
- **返回**：SQLite 数据库实例
- **副作用**：首次调用时执行 schema 初始化

---

### schema.ts — 数据库模式

三张表：

| 表 | 说明 |
|---|---|
| `address_books` | 通讯簿：id, name, sort_order, color_index, created_at, updated_at |
| `contacts` | 联系人：id, address_book_id(FK), level1_dir, level2_dir, name, position, office_phone, mobile_phones, created_at, updated_at |
| `directory_order` | 目录排序：address_book_id(FK), level(1/2), parent_dir, dir_name, sort_order |

**迁移**：自动为旧表添加 `sort_order`、`color_index` 列（幂等）。

---

### address-book-dao.ts — 通讯簿 CRUD

| 方法 | 说明 |
|---|---|
| `getAll()` | 所有通讯簿，按 sort_order 排序，含联系人数量和 color_index |
| `getById(id)` | 单个通讯簿详情 |
| `create(name)` | 新建（sort_order 自动设为最大值+1） |
| `rename(id, name)` | 重命名 |
| `remove(id)` | 删除（CASCADE 删除联系人和目录排序） |
| `reorderAll(ids)` | 拖拽后批量更新 sort_order |
| `setColor(id, colorIndex)` | 设置主题色索引（0-9） |
| `getBookColor(book)` | 获取通讯簿显示色：自定义色优先，否则用 id 决定 |
| `swapOrder(idA, idB)` | 交换两个通讯簿的 sort_order |

---

### contact-dao.ts — 联系人 CRUD

| 方法 | 说明 |
|---|---|
| `getByBookId(bookId, search?)` | 查询联系人。搜索时匹配 6 个字段（忽略半角/全角空格），结果应用层去重 |
| `getById(id)` | 单个联系人 |
| `create(bookId, data)` | 新建 |
| `update(id, data)` | 更新全部字段 |
| `remove(id)` | 删除 |
| `batchCreate(bookId, contacts)` | 事务内批量插入 |
| `getLevel1Dirs(bookId)` | 一级目录列表（按 directory_order 排序） |
| `getLevel2Groups(bookId, level1Dir)` | 二级目录分组+联系人（按 directory_order 排序） |
| `getAllLevel1Dirs(bookId)` | 所有一级目录名（供表单下拉） |
| `getLevel2Dirs(bookId, level1Dir)` | 所有二级目录名 |
| `searchAll(query)` | 全局搜索（跨所有通讯簿），6 字段模糊匹配 + 应用层去重 |
| `searchAllWithBookName(query)` | 全局搜索（带通讯簿名），JOIN address_books，用于分组展示 |
| `toggleFavorite(id, value)` | 切换联系人收藏状态 |
| `getFavorites()` | 获取所有已收藏联系人（含通讯簿名称） |
| `dedupContacts(list)` | 按 (bookId+dirs+姓名) 去重——全部字段先去掉空格再比对 |
| `cleanupDuplicates()` | 清理重复行——保留最新并合并自定义色/收藏，返回移除数 |
| `cleanupOrphans()` | 清理占位联系人「（待添加）」和多余数据，返回 {placeholders, orphans} |
| `countAll()` | 返回 contacts 表总行数（诊断用） |

**搜索实现细节**：
- SQL 端：`REPLACE(REPLACE(COALESCE(field,''),' ',''),'　','')` 同时处理半角和全角空格
- 查询词：`query.trim().replace(/[\s　]+/g, '')` 去除所有空白
- 去重：`GROUP BY address_book_id, name, level1_dir, level2_dir` + 应用层二次过滤

---

### full-backup-dao.ts (`src/db/dao/`) — 全量导入/导出

| 方法 | 说明 |
|---|---|
| `exportFullData()` | 导出全部表（通讯簿、联系人、目录排序），含 sort_order / color_index / is_favorite |
| `importFullData(data)` | 事务内清空所有数据并恢复存档 |

### save-manager.ts (`src/utils/`) — 6 槽位存档文件管理

| 方法 | 说明 |
|---|---|
| `getAllSlots()` | 返回 6 个槽位的元数据（日期、摘要、是否有数据） |
| `saveSlot(index, data)` | 写入存档文件到指定槽位（覆盖） |
| `loadSlot(index)` | 从指定槽位读取存档 |
| `deleteSlot(index)` | 删除指定槽位的存档文件 |

存档存储路径：`FileSystem.documentDirectory/saves/slot_0.json` ~ `slot_5.json`

### directory-dao.ts — 目录 CRUD + 排序

| 方法 | 说明 |
|---|---|
| `getDirectoryTree(bookId)` | 完整目录树（含自定义排序） |
| `createLevel1Dir(bookId, dirName)` | 新建一级目录（含占位联系人） |
| `createLevel2Dir(bookId, level1Dir, dirName)` | 新建二级目录 |
| `renameLevel1Dir(bookId, old, new)` | 重命名：批量更新 contacts + directory_order |
| `renameLevel2Dir(bookId, l1, old, new)` | 重命名二级目录 |
| `deleteLevel1Dir(bookId, dirName)` | 删除目录+下属联系人 |
| `deleteLevel2Dir(bookId, l1, dirName)` | 删除二级目录+下属联系人 |
| `moveDirUp(bookId, level, parent, name)` | 上移一位 |
| `moveDirDown(bookId, level, parent, name)` | 下移一位 |
| `syncAllDirOrders(bookId)` | 进入编辑模式时自动为所有已有目录创建排序条目 |
| `setDirColor(bookId, level, parent, name, idx)` | 设置目录自定义主题色索引 |

---

## 页面组件

### 路由表

| 路由 | 页面 | 交互模式 |
|---|---|---|
| `/` | 通讯簿门户 | 编辑模式：长按拖拽排序、右划编辑/删除 |
| `/search` | 全局搜索 | 跨所有通讯簿模糊搜索 |
| `/favorites` | 收藏联系人 | 按通讯簿分组展示，点击进入详情 |
| `/settings` | 设置 | 导入(→选通讯簿→选文件)、导出 JSON、6 槽位存档管理 |
| `/book/[id]` | 一级目录列表 | 编辑模式：长按拖拽排序、右划编辑/删除 |
| `/book/[id]/[level1]` | 二级目录+手风琴（吸顶锁定） | 编辑模式：长按拖拽排序（组织/联系人）、右划编辑/删除；浏览模式：展开后表头吸顶 |
| `/book/[id]/search` | 通讯簿内搜索 | 300ms 去抖动 |
| `/book/[id]/contact/[contactId]` | 联系人详情 | 拨号、复制、收藏切换、编辑入口 |
| `/book/[id]/contact/[contactId]/edit` | 编辑联系人 (modal) | 表单含目录 chip 选择+自由输入 |
| `/book/[id]/contact/new` | 新建联系人 (modal) | 支持 ?l1=&l2= 预填目录 |

### 编辑模式系统

每层页面 header 有 **🔒编辑 / 🔓完成** 切换按钮：

| 模式 | 操作 |
|---|---|
| 浏览 | 点击→进入，卡片按通讯簿 id 确定颜色 |
| 编辑 | 长按→拖拽排序，右划→编辑/删除，点击→展开（二级目录） |

### 门户页 (index.tsx)
- `DraggableFlatList` 实现通讯簿拖拽排序
- `UnifiedSwipeableWrapper` 包裹每个卡片提供右划编辑/删除
- 编辑弹窗含 10 色主题色选择器
- 删除需要输入通讯簿名称二次确认
- 颜色固定跟随通讯簿（color_index），拖拽后不变

### 一级目录 (book/[id]/index.tsx)
- 编辑模式：`DraggableFlatList` + `UnifiedSwipeableWrapper`
- 工具栏：🔍搜索 / ＋（新建联系人 or 新建一级目录）
- 颜色按目录名称哈希确定，拖拽后保持不变

### 二级目录 (book/[id]/[level1]/index.tsx)
- 编辑模式：`DraggableFlatList` + `UnifiedSwipeableWrapper`，进入时自动折叠所有手风琴
- 点击仍可展开查看联系人（`expanded` 状态独立管理）
- 工具栏：🔍 / ＋（新建联系人 or 新建二级目录）
- AccordionSection 底部有"新增联系人"按钮（自动预填 l1/l2 参数）

---

## Contexts (`src/contexts/`)

### theme.tsx — ThemeProvider + useTheme + useAppTheme

应用主题上下文，提供三种模式 + 统一调色板。

**`ThemeProvider({ children })`**
- 管理 `'light' | 'dark' | 'system'` 三种模式
- 通过 `AsyncStorage`（key: `theme_mode`）持久化用户偏好
- 内部用 `useColorScheme()` 检测系统主题

**`useTheme(): ThemeCtx`**
- 返回 `{ mode, setMode, isDark }`
- `setMode(m)` 同步写入 AsyncStorage

**`useAppTheme()`**
- 返回统一的 30 色亮/暗调色板对象：
  - 容器类：`screen`、`card`、`headerBg`、`dialogBg`、`overlayBg`、`inputBg`
  - 文本类：`text`、`textSecondary`、`textTertiary`
  - 控件类：`border`、`toggle`、`toggleActive`、`inputBorder`、`toolBtnBg`、`toolBtnBorder`、`menuBtnBg`、`editHintBg`、`editHintBorder`、`slotFilledBg`、`warnBg`
  - 特殊类：`warnText`、`arrow`、`contactPhone`、`contactPosition`

---

## Hooks (`src/hooks/`)

### useColorScheme (`use-color-scheme.ts`)
直接 re-export `react-native` 的 `useColorScheme`。`.web.ts` 变体适配 Web 平台。

### useTheme (`use-theme.ts`)
从 `constants/theme.ts` 的 `Colors.light` / `Colors.dark` 取色，供组件级使用。
```typescript
const theme = useTheme(); // 返回 Colors[scheme]
```
被 `ThemedText`、`ThemedView`、`Collapsible` 等组件使用。

### useHapticScale (`use-haptic-scale.ts`)
长按触觉反馈 Hook。返回一个无参回调函数，调用时触发 `impactLight` 震动。
```typescript
const haptic = useHapticScale();
// 在长按回调中：haptic();
```
- 无 Reanimated 依赖，无视觉副作用
- 被 `AddressBookCard`、`DirectoryCard`、`AccordionSection` 统一使用

---

## 工具函数 (`src/utils/import-export.ts`)

### `importFile(bookId?: number): Promise<number>`
统一的文件导入入口。
- **支持格式**：xlsx, xls, et (WPS), csv, json
- **读取方式**：`fetch()` + `ArrayBuffer`（xlsx）/ `text()`（csv/json）
- **JSON**：自动识别并弹出恢复确认
- **表头检测**：优先匹配中英文列名，无表头时按列位置推断（A→F）
- **姓名规范化**：导入时合并所有空白字符为单个半角空格
- **返回值**：导入数量(>0成功)，-1(取消/JSON已处理)，-2(失败)

### `exportJSON(options?: ExportOptions): Promise<void>`
1. 弹出两步向导：选择通讯簿（可多选/全选）→ 选择格式（含样式/纯数据）
2. 按选择导出 address_books + contacts + directory_order
3. 含样式版保留 `color_index`、`is_favorite`、`sort_order`；纯数据版去除
4. 写入临时文件，`Sharing.shareAsync()` 分享

### `shareTemplate(): Promise<void>`
用 `xlsx` 库生成模板文件（表头 + 一行示例），分享下载。

### `exportExcel(bookIds?: number[]): Promise<void>`
导出联系人为 Excel 文件（与导入模板格式一致）。可选 `bookIds` 按通讯簿筛选；不传则导出全部。使用系统分享。

### 自动清理
导入/删除通讯簿、目录后自动执行 `cleanupDuplicates()` + `cleanupOrphans()`，有结果时弹窗。

---

## UI 组件（新增/变更）

### AlertDialog (`src/components/ui/alert-dialog.tsx`)
自定义弹窗组件，替代原生 `Alert.alert`。`AlertDialogProvider` 已在 `_layout.tsx` 注册，通过 `useAlert()` hook 调用：
```typescript
alert.showAlert({ title, message, buttons: [{ text, style, onPress }] });
```
- 深色模式自动适配（`bg: #1E1E1E`），统一 `borderRadius: 16`，居中 + `paddingBottom: 56` 补偿导航栏
- 导入选择器改为分页弹窗（每页 6 个通讯簿，含上一页/下一页/取消）

### PhoneRow — 布局更新
拨号/复制按钮移至号码右侧右对齐（`flexDirection: 'row', space-between`）。

### 莫兰迪深色色板
深色模式卡片使用独立挑选的同系低饱和色（`darkBg` #B0-#D8），保留粉彩柔和感。`ContactRow` 文字根据背景亮度自适应：亮卡片→暗文字。#
### 导出 Excel
设置页新增"导出 Excel 文件"，与导出 JSON 共用通讯簿选择向导，跳样式步骤直接导出。
导入数据、删除通讯簿/目录后自动执行 `cleanupDuplicates()` + `cleanupOrphans()`，有结果时弹窗报告。

---

## UI 组件 (`src/components/`)

### ThemedText (themed-text.tsx)

主题感知文本组件，根据亮/暗模式自动切换颜色。

**Props:**
| Prop | 类型 | 说明 |
|---|---|---|
| `type?` | `'default' \| 'title' \| 'small' \| 'smallBold' \| 'subtitle' \| 'link' \| 'linkPrimary' \| 'code'` | 预设文本样式（字号+行高+字重） |
| `themeColor?` | `ThemeColor` | 覆盖默认 text 色 |

支持标准 `TextProps` 透传。

### ThemedView (themed-view.tsx)

主题感知容器组件，自动适配背景色。Props: `type?`（背景色 key，默认 `'background'`）。支持标准 `ViewProps` 透传。

### Icon (icon.tsx)

MaterialIcons 封装，自动跟随主题色。

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | `MaterialIcons['name']` | 必填 | 图标名称 |
| `size?` | `number` | `22` | 图标大小 |
| `color?` | `string` | — | 自定义颜色，默认主题 text 色 |
| `secondary?` | `boolean` | — | 使用 `textSecondary` 色 |

### Collapsible (ui/collapsible.tsx)

通用可折叠面板，点击标题 chevron 旋转 90°，内容 `FadeIn.duration(200)` 淡入。Props: `title` + `children`。

### AnimatedSplashOverlay (animated-icon.tsx)

启动动画叠加层。Reanimated `Keyframe` 驱动缩放+透明度（600ms），背景 `#208AEF`，动画完成后通过 `scheduleOnRN`（react-native-worklets）卸载。`AnimatedIcon` 可复用。

### UnifiedSwipeableWrapper (ui/swipeable-row.tsx)

统一的右划操作容器，全应用所有可滑动的列表项共用此组件。

**五项核心机制：**

| 机制 | 实现 | 解决的问题 |
|---|---|---|
| 双向物理锁死 | `overshootLeft/Right={false}` | 卡片飞出界 / 按钮压扁 |
| 轻快跟手滑动 | `friction={1}`, `rightThreshold={30}`, `overshootFriction={8}` | 滑动"卡手"、触发距离太长 |
| 对角滑动容差 | `failOffsetY={[-20, 20]}` | 略带角度的滑动被竖向滚动拦截 |
| onLayout 等高同步 | `useState` + 前景 View `onLayout` → 写入 actionsRow `height` | 不等高（含手风琴展开/折叠） |
| 固定按钮宽度 | 每个按钮 `width: 72`，不用 flex | 按钮坍塌 |

**Props:**

| Prop | 类型 | 说明 |
|---|---|---|
| `enabled` | `boolean` | 是否启用滑动（编辑模式） |
| `onEdit` | `() => void` | 编辑按钮回调 |
| `onDelete` | `() => void` | 删除按钮回调 |
| `cardBackgroundColor` | `string` | **必填**。卡片背景色，同时注入裁剪容器和前景 View，确保圆角处不露异色 |
| `borderRadius?` | `number \| CornerRadii` | 动态圆角。`number`=统一；`CornerRadii`=逐角控制（如手风琴展开时上圆下方） |
| `style?` | `object` | 外层间距（Zero-Gap 原则：卡片间距仅在此设置） |

**架构：**

```
<View style={spacing}>                         ← 间距层
  <Swipeable
    containerStyle={{ overflow:'hidden', borderRadius, backgroundColor }}  ← 裁剪层
    childrenContainerStyle={{ backgroundColor:'transparent' }}
    overshootLeft={false} overshootRight={false}  ← 双向锁死
  >
    <View onLayout={...} borderRadius=0>          ← 前景卡片 (去圆角)
      {卡片内容}
    </View>
  </Swipeable>
</View>
```

**向下兼容：** `SwipeableRow` 仍可作为别名使用（已 deprecated）。

### AccordionSection (ui/accordion-section.tsx)
可折叠手风琴。Props:
- `title`, `count`, `bgColor`, `fgColor`
- `expanded?` / `onToggle?` — 外部控制展开状态
- `headerOnPress?` / `headerOnLongPress?` — 自定义头部交互。长按自动触发震动反馈（280ms 延迟）
- `footer?` — 展开后底部内容
- `containerStyle?` — 覆盖外层容器样式
- `children` — 联系人列表

### AddressBookCard
通讯簿大卡片。Props: `book`, `index`(色板), `onPress`, `onLongPress?`
- 颜色优先用 `book.colorIndex`，否则用 `index`
- 长按自动触发震动反馈（280ms 延迟），回调 `onLongPress`

### DirectoryCard
目录卡片。Props: `name`, `count`, `bgColor`, `fgColor`, `onPress`, `onLongPress?`
- 颜色由父组件计算并传入：`colorIndex ≥ 0` 用自定义色，否则用 `hashIndex(name)`
- 长按自动触发震动反馈（280ms 延迟），回调 `onLongPress`

### ContactRow
联系人行（圆形头像+姓名+职务+手机号+箭头）。Props: `contact`, `onPress`
- 头像颜色优先级：`contact.colorIndex ≥ 0` → 自定义色；否则 `getNameColor(contact.name)` 按姓名首字符取色

### PhoneRow
电话号行（标签+号码+📞拨号+📋复制）。Props: `label`, `phone`
- 拨号：直接用 `Linking.openURL('tel:...')`，try/catch 兜底

### ContactForm
联系人创建/编辑表单。Props:
- `contact?` — 编辑模式预填
- `initialLevel1?` / `initialLevel2?` — 新建模式预填目录
- `level1Options` / `level2Options` — chip 选项
- `onLevel1Change` / `onSave` / `onDelete?`
- 手机号字段改为**选填**，支持动态增减
- **头像颜色选择器**：Morris 10 色板 + ↺ 恢复默认，写入 `ContactFormData.colorIndex`

---

## 常量 (`src/constants/`)

### colors.ts — Morris 色板

```typescript
const MorrisColors = [
  { name: 'Sand',    bg: '#F5E6D3', fg: '#8B6914' },
  { name: 'Sage',    bg: '#D4E8D0', fg: '#2D5A27' },
  { name: 'Sky',     bg: '#D6E4F0', fg: '#1A4B7A' },
  { name: 'Mauve',   bg: '#E8D5E0', fg: '#6B3A5A' },
  { name: 'Apricot', bg: '#F0D8C8', fg: '#8B4513' },
  { name: 'Moss',    bg: '#D5E8D4', fg: '#3D6B35' },
  { name: 'Lavender',bg: '#E0D5F0', fg: '#4A2D70' },
  { name: 'Rose',    bg: '#F0D5D5', fg: '#8B3A3A' },
  { name: 'Teal',    bg: '#D0E8E8', fg: '#1A6B6B' },
  { name: 'Peach',   bg: '#F5E0D0', fg: '#8B5A3A' },
];
```

| 函数 | 说明 |
|---|---|
| `getMorrisColor(index)` | 按索引取色（循环），用于 card/avatar 的自定义颜色 |
| `getNameColor(name)` | 按姓名字符取色（仅当 `colorIndex = -1` 时作为头像默认色） |
| `hashIndex(s, max)` | 字符串哈希 → 0..max-1（仅当 `colorIndex = -1` 时作为目录默认色） |

**颜色统一规则：**

| 实体 | 存储位置 | 自定义色 `≥0` | 默认色 `= -1` |
|---|---|---|---|
| 通讯簿 | `address_books.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(id)` |
| 一级目录 | `directory_order.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(hashIndex(dirName, 10))` |
| 二级目录 | `directory_order.color_index` | `getMorrisColor(colorIndex)` | `getMorrisColor(hashIndex(dirName, 10))` |
| 联系人头像 | `contacts.color_index` | `getMorrisColor(colorIndex)` | `getNameColor(name)` |

### theme.ts — 主题配置
- `Colors.light` / `Colors.dark` — 亮/暗色板
- `Spacing` — 间距常量（half:2 → six:64）
- `Fonts` — 平台字体族

---

## 项目入口 (`src/app/_layout.tsx`)

```
GestureHandlerRootView          ← 手势系统根容器
  ThemeProvider                  ← 自定义亮/暗/系统主题（AsyncStorage 持久化）
    ExpoThemeProvider            ← expo-router 导航主题
      Stack                      ← expo-router 导航栈（10 routes, slide_from_right）
  AnimatedSplashOverlay          ← 启动动画叠加层（Keyframe + Reanimated）
```

**主题双层架构：**
- `src/contexts/theme.tsx` — `ThemeProvider`（`light`/`dark`/`system` 模式 + AsyncStorage）+ `useAppTheme()` 返回 30 色统一调色板
- `src/hooks/use-theme.ts` — `useTheme()` 组件级取色（`Colors[scheme]`）
- `ThemedText` / `ThemedView` / `Icon` 组件依赖上述 hooks 自动适配亮暗
- `expo-system-ui` 在根组件设置系统背景色

**技术栈新增：**
- `expo-haptics`（长按震动反馈）
- `expo-system-ui`（系统背景色控制）
- `expo-splash-screen`（启动画面）
- `expo-image`（高性能图片）
- `expo-symbols`（SF Symbols / Material 图标）
- `@expo/ui` / `@expo/vector-icons`（UI 组件+图标）
- `@react-native-async-storage/async-storage`（主题偏好持久化）
- `react-native-worklets`（Worklet 线程调度）
- `react-native-safe-area-context` / `react-native-screens`（原生导航）

