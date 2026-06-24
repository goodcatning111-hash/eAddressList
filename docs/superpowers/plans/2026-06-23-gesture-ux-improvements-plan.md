# Gesture UX 优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化右划跟手性、长按缩放反馈、触觉确认——让电子通讯录的手势交互更丝滑。

**Architecture:** 复用一个共享 hook (`useHapticScale`) 封装 Reanimated 缩放动画 + expo-haptics 触觉逻辑；三个卡片组件统一接入；SwipeableWrapper 纯参数调优。无需改动页面架构或数据流。

**Tech Stack:** React Native, expo-haptics (~56.0.3), react-native-reanimated 4.3.1, react-native-gesture-handler 2.31.1

## Global Constraints

- expo-haptics 版本 ~56.0.3（SDK 56 内置，仅需 expo install）
- delayLongPress 统一 280ms
- scale 弹起 1.04、拖拽中保持缩放
- Spring: damping=15/stiffness=200（弹起），damping=12/stiffness=150（回弹）
- failOffsetY: [-20, 20]（允许 ±20px 垂直偏移）

---

### Task 1: Install expo-haptics

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

```bash
npx expo install expo-haptics
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('expo-haptics'); console.log('OK')"
```

Expected: `OK` (no error)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-haptics for gesture feedback
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Optimize SwipeableWrapper — friction + diagonal tolerance

**Files:**
- Modify: `src/components/ui/swipeable-row.tsx`

**Interfaces:**
- Produces: Swipeable now uses `friction={1}`, `rightThreshold={30}`, `overshootFriction={8}`, `failOffsetY={[-20, 20]}`

- [ ] **Step 1: Adjust Swipeable props**

In `src/components/ui/swipeable-row.tsx`, replace the `<Swipeable` opening tag props (lines 113-119):

```tsx
// BEFORE (lines 115-119):
        friction={1.5}
        rightThreshold={40}
        // Bidirectional clamp → card cannot fly past the action area.
        overshootLeft={false}
        overshootRight={false}

// AFTER:
        friction={1}
        rightThreshold={30}
        overshootFriction={8}
        failOffsetY={[-20, 20]}
        overshootLeft={false}
        overshootRight={false}
```

The full `<Swipeable>` opening block will look like:

```tsx
      <Swipeable
        renderRightActions={renderRightActions}
        friction={1}
        rightThreshold={30}
        overshootFriction={8}
        failOffsetY={[-20, 20]}
        overshootLeft={false}
        overshootRight={false}
        containerStyle={[
          radiusStyle,
          {
            overflow: 'hidden',
            backgroundColor: cardBackgroundColor,
          },
        ]}
        childrenContainerStyle={styles.childrenContainer}
      >
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors related to `swipeable-row.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/swipeable-row.tsx
git commit -m "perf(swipeable): lower friction, add diagonal tolerance, overshoot spring
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create shared useHapticScale hook

**Files:**
- Create: `src/hooks/use-haptic-scale.ts`

**Interfaces:**
- Consumes: expo-haptics (Task 1)
- Produces:
  ```typescript
  function useHapticScale(isDragging: boolean): {
    animatedStyle: { transform: [{ scale: SharedValue<number> }] };
    triggerHapticScale: () => void;
  }
  ```

- [ ] **Step 1: Create the hook file**

```typescript
import { useEffect, useRef } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * Shared hook for card long-press scale animation + haptic feedback.
 *
 * - On triggerHapticScale(): scale springs to 1.04 + impactLight haptic
 * - When isDragging flips true→false: scale springs back to 1.0 + impactLight haptic
 *
 * @param isDragging - whether the card is currently being dragged (from DraggableFlatList isActive)
 */
export function useHapticScale(isDragging: boolean) {
  const scale = useSharedValue(1);
  const wasDragging = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const triggerHapticScale = () => {
    scale.value = withSpring(1.04, { damping: 15, stiffness: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // When drag ends (isDragging: true → false), spring back + haptic
  useEffect(() => {
    if (!isDragging && wasDragging.current) {
      scale.value = withSpring(1.0, { damping: 12, stiffness: 150 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    wasDragging.current = isDragging;
  }, [isDragging]);

  return { animatedStyle, triggerHapticScale };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-haptic-scale.ts
git commit -m "feat: add useHapticScale hook for long-press scale animation + haptics
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update AddressBookCard + portal page

**Files:**
- Modify: `src/components/address-book-card.tsx`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `useHapticScale` (Task 3)
- Produces: `AddressBookCard` now accepts `isDragging?: boolean` prop

- [ ] **Step 1: Rewrite AddressBookCard**

Replace `src/components/address-book-card.tsx`:

```typescript
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { getMorrisColor } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';
import type { AddressBook } from '@/db/types';

interface Props {
  book: AddressBook;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Whether this card is being dragged (from DraggableFlatList isActive). */
  isDragging?: boolean;
}

/** 通讯簿大卡片 — 用于门户页展示 */
export function AddressBookCard({ book, index, onPress, onLongPress, isDragging = false }: Props) {
  const colorIdx = book.colorIndex >= 0 ? book.colorIndex : index;
  const color = getMorrisColor(colorIdx);
  const { animatedStyle, triggerHapticScale } = useHapticScale(isDragging);

  const handleLongPress = () => {
    triggerHapticScale();
    onLongPress?.();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.bg },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={280}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={[styles.name, { color: color.fg }]}>{book.name}</Text>
        <Text style={[styles.count, { color: color.fg }]}>
          {book.contactCount} 人
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.five,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  count: {
    fontSize: 18,
    fontWeight: '500',
    opacity: 0.7,
  },
});
```

- [ ] **Step 2: Pass isDragging from portal page**

In `src/app/index.tsx`, line 218-223, add `isDragging={isActive}` to `<AddressBookCard>`:

```tsx
// Find this block in renderItem (around line 218):
                  <AddressBookCard
                    book={item}
                    index={item.id}
                    onPress={() => {}}
                    onLongPress={() => drag()}
                  />

// Replace with:
                  <AddressBookCard
                    book={item}
                    index={item.id}
                    onPress={() => {}}
                    onLongPress={() => drag()}
                    isDragging={isActive}
                  />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/address-book-card.tsx src/app/index.tsx
git commit -m "feat: add scale animation + haptic to AddressBookCard long press
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update DirectoryCard + level1 page

**Files:**
- Modify: `src/components/directory-card.tsx`
- Modify: `src/app/book/[id]/index.tsx`

**Interfaces:**
- Consumes: `useHapticScale` (Task 3)
- Produces: `DirectoryCard` now accepts `isDragging?: boolean` prop

- [ ] **Step 1: Rewrite DirectoryCard**

Replace `src/components/directory-card.tsx`:

```typescript
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';

interface Props {
  name: string;
  count: number;
  bgColor: string;
  fgColor: string;
  onPress: () => void;
  onLongPress?: () => void;
  isDragging?: boolean;
}

/** 一级/二级目录卡片 */
export function DirectoryCard({
  name,
  count,
  bgColor,
  fgColor,
  onPress,
  onLongPress,
  isDragging = false,
}: Props) {
  const { animatedStyle, triggerHapticScale } = useHapticScale(isDragging);

  const handleLongPress = () => {
    triggerHapticScale();
    onLongPress?.();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bgColor },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={280}
    >
      <Animated.View style={[styles.row, animatedStyle]}>
        <Text style={[styles.name, { color: fgColor }]}>{name}</Text>
        <Text style={[styles.count, { color: fgColor }]}>
          {count} 人
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: Spacing.four,
    minHeight: 64,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  count: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
});
```

- [ ] **Step 2: Pass isDragging from level1 page**

In `src/app/book/[id]/index.tsx`, line 223-231, add `isDragging={isActive}` to `<DirectoryCard>`:

```tsx
// Find this block (around line 223):
                  <DirectoryCard
                    name={item.level1Dir}
                    count={item.count}
                    bgColor={color.bg}
                    fgColor={color.fg}
                    onPress={() => {}}
                    onLongPress={() => drag()}
                  />

// Replace with:
                  <DirectoryCard
                    name={item.level1Dir}
                    count={item.count}
                    bgColor={color.bg}
                    fgColor={color.fg}
                    onPress={() => {}}
                    onLongPress={() => drag()}
                    isDragging={isActive}
                  />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/directory-card.tsx "src/app/book/[id]/index.tsx"
git commit -m "feat: add scale animation + haptic to DirectoryCard long press
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Update AccordionSection + level2 page

**Files:**
- Modify: `src/components/ui/accordion-section.tsx`
- Modify: `src/app/book/[id]/[level1]/index.tsx`

**Interfaces:**
- Consumes: `useHapticScale` (Task 3)
- Produces: `AccordionSection` accepts `isDragging?: boolean`

- [ ] **Step 1: Rewrite AccordionSection**

Replace `src/components/ui/accordion-section.tsx`:

```typescript
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';
import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';

interface Props extends PropsWithChildren {
  title: string;
  count: number;
  bgColor: string;
  fgColor: string;
  footer?: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  headerOnPress?: () => void;
  headerOnLongPress?: () => void;
  /** Whether this section is being dragged (from DraggableFlatList isActive). */
  isDragging?: boolean;
  containerStyle?: object;
}

/** 可折叠手风琴组件 — 用于二级目录展开/折叠联系人列表 */
export function AccordionSection({
  title,
  count,
  bgColor,
  fgColor,
  children,
  footer,
  expanded: externalExpanded,
  onToggle,
  headerOnPress,
  headerOnLongPress,
  isDragging = false,
  containerStyle,
}: Props) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const { animatedStyle, triggerHapticScale } = useHapticScale(isDragging);

  const toggle = () => {
    if (onToggle) onToggle();
    else setInternalExpanded(!internalExpanded);
  };

  const handleLongPress = () => {
    triggerHapticScale();
    headerOnLongPress?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle]}>
      <Pressable
        style={styles.header}
        onPress={() => {
          if (headerOnPress) headerOnPress();
          else toggle();
        }}
        onLongPress={handleLongPress}
        delayLongPress={280}
      >
        <Animated.View style={[styles.headerInner, animatedStyle]}>
          <View style={styles.headerLeft}>
            <Text
              style={[styles.title, { color: fgColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <Text style={[styles.count, { color: fgColor }]}>
              ({count})
            </Text>
          </View>
          <Text style={[styles.chevron, { color: fgColor }]}>
            {expanded ? '▲' : '▼'}
          </Text>
        </Animated.View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {children}
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    marginRight: Spacing.two,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  count: {
    fontSize: 14,
    opacity: 0.7,
    marginLeft: Spacing.one,
  },
  chevron: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  body: {
    paddingBottom: Spacing.one,
  },
});
```

- [ ] **Step 2: Pass isDragging from level2 page**

In `src/app/book/[id]/[level1]/index.tsx`, around line 234, add `isDragging={isActive}` to `<AccordionSection>`:

```tsx
// Find the AccordionSection block (around line 234-265), add the prop:
                  <AccordionSection
                    title={item.level2Dir}
                    count={item.contacts.length}
                    bgColor={color.bg}
                    fgColor={color.fg}
                    expanded={isExpanded}
                    onToggle={() => {
                      setExpandedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(item.level2Dir)) next.delete(item.level2Dir);
                        else next.add(item.level2Dir);
                        return next;
                      });
                    }}
                    headerOnLongPress={() => drag()}
                    isDragging={isActive}
                    containerStyle={
                      isExpanded && hasSubItems
                        ? { marginBottom: 0, borderBottomStartRadius: 0, borderBottomEndRadius: 0 }
                        : { marginBottom: 0 }
                    }
                  >
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/accordion-section.tsx "src/app/book/[id]/[level1]/index.tsx"
git commit -m "feat: add scale animation + haptic to AccordionSection long press
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run full TypeScript check:**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: No new errors (pre-existing errors OK)

- [ ] **Summary of all changes:**

| Task | Files | Key Change |
|---|---|---|
| 1 | `package.json` | Add expo-haptics |
| 2 | `swipeable-row.tsx` | friction 1.0, threshold 30, overshoot 8, failOffsetY ±20 |
| 3 | `use-haptic-scale.ts` (new) | Shared hook: scale spring + haptic |
| 4 | `address-book-card.tsx`, `index.tsx` | Scale anim + isDragging prop |
| 5 | `directory-card.tsx`, `book/[id]/index.tsx` | Scale anim + isDragging prop |
| 6 | `accordion-section.tsx`, `book/[id]/[level1]/index.tsx` | Scale anim + isDragging prop |
