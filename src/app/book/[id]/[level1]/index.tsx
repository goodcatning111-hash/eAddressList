import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Icon } from '@/components/icon';
import { AccordionSection } from '@/components/ui/accordion-section';
import { UnifiedSwipeableWrapper } from '@/components/ui/swipeable-row';
import { ContactRow } from '@/components/contact-row';
import { getMorrisColorForTheme, hashIndex, MorrisColors, lightenColor, getContactBg } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import * as contactDao from '@/db/dao/contact-dao';
import * as directoryDao from '@/db/dao/directory-dao';
import type { Level2Group, Contact } from '@/db/types';

// ---------------------------------------------------------------------------
// Contact-reorder list (flat contact list with section dividers)
// ---------------------------------------------------------------------------

type FlatItem = { type: 'header'; key: string; sectionKey: string; title: string; count: number; bg: string; fg: string }
              | { type: 'contact'; key: string; contact: Contact; sectionKey: string; sectionBg: string; sectionFg: string };

function buildFlatList(groups: Level2Group[], isDark: boolean): FlatItem[] {
  const items: FlatItem[] = [];
  for (const g of groups) {
    const color = getMorrisColorForTheme(
      g.colorIndex >= 0 ? g.colorIndex : hashIndex(g.level2Dir, MorrisColors.length), isDark
    );
    items.push({ type: 'header', key: `h-${g.level2Dir}`, sectionKey: g.level2Dir, title: g.level2Dir, count: g.contacts.length, bg: color.bg, fg: color.fg });
    for (const c of g.contacts) {
      items.push({ type: 'contact', key: `c-${c.id}`, contact: c, sectionKey: g.level2Dir, sectionBg: color.bg, sectionFg: color.fg });
    }
  }
  return items;
}

function ContactReorderView({ bookId, level1Dir, groups, onSaved, theme }: { bookId: number; level1Dir: string; groups: Level2Group[]; onSaved: () => void; theme: Record<string, string> }) {
  const { isDark } = useTheme();
  const router = useRouter();
  const items = buildFlatList(groups, isDark);

  return (
    <View style={{ flex: 1, paddingHorizontal: Spacing.four }}>
      <DraggableFlatList
        bounces={true}
        alwaysBounceVertical={true}
        data={items}
        keyExtractor={(item) => item.key}
        onDragEnd={async ({ data }) => {
          // Rebuild groups from the reordered flat list
          const newGroups: { sectionKey: string; contacts: Contact[] }[] = [];
          let currentSection: string | null = null;
          for (const item of data) {
            if (item.type === 'header') {
              currentSection = item.sectionKey;
              // Deduplicate: remove previous contacts of same section
              const existing = newGroups.find(g => g.sectionKey === currentSection);
              if (!existing) newGroups.push({ sectionKey: item.sectionKey!, contacts: [] });
            } else if (item.type === 'contact' && currentSection !== null) {
              const group = newGroups.find(g => g.sectionKey === currentSection);
              if (group) group.contacts.push(item.contact!);
            }
          }
          // Update database
          const db = await (await import('@/db/database')).getDatabase();
          for (const ng of newGroups) {
            for (let i = 0; i < ng.contacts.length; i++) {
              await db.runAsync(
                'UPDATE contacts SET level2_dir = ?, updated_at = ? WHERE id = ?',
                [ng.sectionKey, Date.now(), ng.contacts[i].id]
              );
            }
          }
          // Also update directory_order sort
          for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const exists = await db.getFirstAsync<{ id: number }>(
              'SELECT id FROM directory_order WHERE address_book_id = ? AND level = 2 AND parent_dir = ? AND dir_name = ?',
              [bookId, level1Dir, g.level2Dir]
            );
            if (exists) {
              await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [i, exists.id]);
            }
          }
          onSaved();
        }}
        renderItem={({ item, drag, isActive }) => {
          if (item.type === 'header') {
            return (
              <View style={[{ backgroundColor: item.bg, borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, marginTop: Spacing.three, marginBottom: Spacing.one }]}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: item.fg }}>{item.title} ({item.count})</Text>
              </View>
            );
          }
          // Contact item
          const c = item.contact!;
          const lastName = c.name.length > 0 ? c.name[c.name.length - 1] : '?';
          const avatarColor = c.colorIndex >= 0 ? getMorrisColorForTheme(c.colorIndex, isDark) : getMorrisColorForTheme(hashIndex(c.name, MorrisColors.length), isDark);
          const primaryPhone = c.mobilePhones ? c.mobilePhones.split(',')[0].trim() : '';
          return (
            <Pressable
              style={[
                { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, backgroundColor: getContactBg(item.sectionBg!, isDark), borderRadius: 8, marginBottom: Spacing.half },
                isActive && { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }
              ]}
              onPress={() => router.push(`/book/${bookId}/contact/${c.id}`)}
              onLongPress={drag}
              delayLongPress={280}
            >
              <View style={[{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: avatarColor.bg, marginRight: Spacing.two }]}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: avatarColor.fg }}>{lastName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: isDark ? '#E0E0E0' : '#000' }}>{c.name}</Text>
                {c.position ? <Text style={{ fontSize: 12, color: isDark ? '#AAA' : '#606060' }} numberOfLines={1}>{c.position}</Text> : null}
              </View>
              {primaryPhone ? <Text style={{ fontSize: 13, color: isDark ? '#AAA' : '#606060', marginRight: Spacing.one }}>{primaryPhone}</Text> : null}
            </Pressable>
          );
        }}
      />
      <View style={{ height: 40 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Accordion sticky view — manual floating header via onLayout + absolute overlay
//
// Why manual instead of stickyHeaderIndices / stickySectionHeadersEnabled?
//   1. RN's built-in sticky headers clone the view to a separate layer,
//      which breaks Pressable touch events (well-known RN bug).
//   2. Collapsed sections should NOT stick — built-in APIs can't distinguish.
//   3. Rounded corners leak content behind the sticky clone.
//
// Production pattern: track header Y positions via onLayout (fired once
// after render, not during scroll — cheap), then on scroll compare
// scrollY against pre-captured positions to show/hide a perfectly
// positioned floating header overlay rendered OUTSIDE the ScrollView.
// ---------------------------------------------------------------------------

type StickyItem =
  | { type: 'header'; key: string; group: Level2Group }
  | { type: 'contact'; key: string; contact: Contact; group: Level2Group }
  | { type: 'footer'; key: string; group: Level2Group };

function AccordionStickyView({ groups, bookId, level1Dir, expandedGroups, onToggleExpand, theme }: {
  groups: Level2Group[];
  bookId: number;
  level1Dir: string;
  expandedGroups: Set<string>;
  onToggleExpand: (dir: string) => void;
  theme: Record<string, string>;
}) {
  const { isDark } = useTheme();
  const router = useRouter();

  // ── captured layout positions ──────────────────────────────────────
  // key = dirName → { headerTop, headerH, footerBottom } in scroll-content coords
  const layouts = useRef(new Map<string, { headerTop: number; headerH: number; footerBottom: number }>());
  const scrollY = useRef(0);
  const [floatingDir, setFloatingDir] = useState<string | null>(null);
  const [floatingNearEnd, setFloatingNearEnd] = useState(false);

  // ── flat items (rebuilt on expand/collapse) ────────────────────────
  const flatItems: StickyItem[] = useMemo(() => {
    const items: StickyItem[] = [];
    for (const g of groups) {
      const isExpanded = expandedGroups.has(g.level2Dir);
      items.push({ type: 'header', key: `h-${g.level2Dir}`, group: g });
      if (isExpanded) {
        for (const c of g.contacts) {
          items.push({ type: 'contact', key: `c-${c.id}`, contact: c, group: g });
        }
        items.push({ type: 'footer', key: `f-${g.level2Dir}`, group: g });
      }
    }
    return items;
  }, [groups, expandedGroups]);

  // scroll ref for manual position correction on collapse
  const scrollRef = useRef<ScrollView>(null);

  // ── determine which header (if any) should float ───────────────────
  const FOOTER_H = 60;               // ~"新增联系人" footer height
  const R = 12;                      // card border radius
  const HALF_R = R / 2;              // 6px — the user's "half radius"

  const recomputeFloating = useCallback((y: number) => {
    scrollY.current = y;
    let best: string | null = null;
    let nearEnd = false;

    for (const g of groups) {
      if (!expandedGroups.has(g.level2Dir)) continue;
      const lo = layouts.current.get(g.level2Dir);
      if (!lo) continue;
      // Disappear later:  FOOTER_H - HALF_R = 54px
      // Round earlier:    FOOTER_H + HALF_R = 66px
      if (lo.headerTop + HALF_R < y && lo.footerBottom - (FOOTER_H - HALF_R) > y) {
        best = g.level2Dir;
        nearEnd = lo.footerBottom - y < FOOTER_H + HALF_R; // 66px
        break;
      }
    }

    setFloatingDir(prev => (prev !== best ? best : prev));
    setFloatingNearEnd(nearEnd);
  }, [groups, expandedGroups]);

  // ── on expand/collapse, re-measure then correct scroll position ────
  // Track which dirName was last toggled so we can scroll-stabilise
  const lastToggled = useRef<string | null>(null);
  const wrappedToggle = useCallback((dir: string) => {
    lastToggled.current = dir;
    onToggleExpand(dir);
  }, [onToggleExpand]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      recomputeFloating(scrollY.current);

      // After collapse, scroll to keep the toggled header at its natural position
      const dir = lastToggled.current;
      if (dir && !expandedGroups.has(dir)) {
        // Section was just collapsed — scroll back to its header if needed
        const lo = layouts.current.get(dir);
        if (lo && scrollY.current > lo.headerTop) {
          scrollRef.current?.scrollTo({ y: lo.headerTop, animated: false });
          recomputeFloating(lo.headerTop);
        }
      }
      lastToggled.current = null;
    });
    return () => cancelAnimationFrame(id);
  }, [flatItems]);

  // ── header render helper (normal, non-floating headers only) ──────
  const renderHeader = (group: Level2Group) => {
    const color = getMorrisColorForTheme(
      group.colorIndex >= 0 ? group.colorIndex : hashIndex(group.level2Dir, MorrisColors.length),
      isDark,
    );
    const isExpanded = expandedGroups.has(group.level2Dir);
    return (
      <View
        style={{
          backgroundColor: color.bg,
          paddingVertical: Spacing.three,
          paddingHorizontal: Spacing.four,
          ...(isExpanded
            ? { borderTopStartRadius: 12, borderTopEndRadius: 12, marginBottom: 0 }
            : { borderRadius: 12, marginBottom: Spacing.three }),
        }}
      >
        <Pressable onPress={() => wrappedToggle(group.level2Dir)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1, marginRight: Spacing.two, minWidth: 0 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: color.fg, flexShrink: 1 }} numberOfLines={1}>{group.level2Dir}</Text>
              <Text style={{ fontSize: 14, opacity: 0.7, color: color.fg, marginLeft: Spacing.one }}>({group.contacts.length})</Text>
            </View>
            <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={color.fg} />
          </View>
        </Pressable>
      </View>
    );
  };

  // ── floating header data ───────────────────────────────────────────
  const floatingGroup = floatingDir ? groups.find(g => g.level2Dir === floatingDir) : undefined;

  // ── render ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* FLOATING OVERLAY — rendered OUTSIDE ScrollView, normal touch handling */}
      {floatingGroup && expandedGroups.has(floatingGroup.level2Dir) && (() => {
        const fColor = getMorrisColorForTheme(
          floatingGroup.colorIndex >= 0 ? floatingGroup.colorIndex : hashIndex(floatingGroup.level2Dir, MorrisColors.length),
          isDark,
        );
        const isExpanded = expandedGroups.has(floatingGroup.level2Dir);
        return (
          // Sticky toolbar — flat top, bottom rounds only in the "near end" zone
          // (66px–54px before footer).  No top border-radius = no peek-through.
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: Spacing.four,
              right: Spacing.four,
              zIndex: 10,
              backgroundColor: fColor.bg,
              borderBottomStartRadius: floatingNearEnd ? R : 0,
              borderBottomEndRadius: floatingNearEnd ? R : 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 3,
              elevation: 3,
            }}
          >
            <View style={{ paddingVertical: Spacing.three, paddingHorizontal: Spacing.four }}>
              <Pressable onPress={() => wrappedToggle(floatingGroup.level2Dir)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1, marginRight: Spacing.two, minWidth: 0 }}>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: fColor.fg, flexShrink: 1 }} numberOfLines={1}>{floatingGroup.level2Dir}</Text>
                    <Text style={{ fontSize: 14, opacity: 0.7, color: fColor.fg, marginLeft: Spacing.one }}>({floatingGroup.contacts.length})</Text>
                  </View>
                  <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={fColor.fg} />
                </View>
              </Pressable>
            </View>
          </View>
        );
      })()}

      {/* MAIN SCROLL CONTENT */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        bounces
        alwaysBounceVertical
        scrollEventThrottle={16}
        onScroll={e => recomputeFloating(e.nativeEvent.contentOffset.y)}
      >
        {flatItems.map(item => {
          if (item.type === 'header') {
            return (
              <View
                key={item.key}
                onLayout={e => {
                  const { y, height } = e.nativeEvent.layout;
                  const prev = layouts.current.get(item.group.level2Dir) ?? { headerTop: 0, headerH: 0, footerBottom: 0 };
                  layouts.current.set(item.group.level2Dir, { ...prev, headerTop: y, headerH: height });
                }}
              >
                {renderHeader(item.group)}
              </View>
            );
          }
          if (item.type === 'contact') {
            const color = getMorrisColorForTheme(
              item.group.colorIndex >= 0 ? item.group.colorIndex : hashIndex(item.group.level2Dir, MorrisColors.length),
              isDark,
            );
            return (
              <View key={item.key} style={{ backgroundColor: color.bg, paddingHorizontal: Spacing.two }}>
                <ContactRow
                  contact={item.contact}
                  onPress={() => router.push(`/book/${bookId}/contact/${item.contact.id}`)}
                  backgroundColor={getContactBg(color.bg, isDark)}
                />
              </View>
            );
          }
          // footer
          const fColor = getMorrisColorForTheme(
            item.group.colorIndex >= 0 ? item.group.colorIndex : hashIndex(item.group.level2Dir, MorrisColors.length),
            isDark,
          );
          return (
            <View
              key={item.key}
              onLayout={e => {
                const { y, height } = e.nativeEvent.layout;
                const prev = layouts.current.get(item.group.level2Dir) ?? { headerTop: 0, headerH: 0, footerBottom: 0 };
                layouts.current.set(item.group.level2Dir, { ...prev, footerBottom: y + height });
              }}
              style={{ backgroundColor: fColor.bg, borderBottomStartRadius: 12, borderBottomEndRadius: 12, paddingBottom: Spacing.one, marginBottom: Spacing.three }}
            >
              <Pressable
                style={[styles.addContactBtn, { borderTopColor: theme.border }]}
                onPress={() =>
                  router.push(`/book/${bookId}/contact/new?l1=${encodeURIComponent(level1Dir)}&l2=${encodeURIComponent(item.group.level2Dir)}`)
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="add" size={15} color="#208AEF" />
                  <Text style={{ fontSize: 15, color: '#208AEF' }}> 新增联系人</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

/** 页面 3：二级目录手风琴 + 联系人列表 — 支持编辑模式 */
export default function Level2Screen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, level1 } = useLocalSearchParams<{ id: string; level1: string }>();
  const bookId = Number(id);
  const level1Dir = decodeURIComponent(level1 ?? '');
  const { isDark } = useTheme();

  const [groups, setGroups] = useState<Level2Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [contactReorderMode, setContactReorderMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 弹窗
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'rename'>('create');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogText, setDialogText] = useState('');
  const [dialogTarget, setDialogTarget] = useState('');
  const [dialogColorIdx, setDialogColorIdx] = useState(0);

  // Dark mode theme colours
  const theme = {
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#2A2A2A' : '#FFFFFF',
    toggle: isDark ? '#383838' : '#F0F0F3',
    textSecondary: isDark ? '#AAA' : '#808080',
    textPrimary: isDark ? '#E0E0E0' : '#000000',
    border: isDark ? '#3A3A3A' : '#E0E0E0',
    editHintBg: isDark ? '#2A2A2A' : '#FFF8E1',
    editHintBorder: isDark ? '#444' : '#FFE0B2',
    dialogBg: isDark ? '#1E1E1E' : '#FFFFFF',
    inputBg: isDark ? '#333' : '#FFFFFF',
    inputBorder: isDark ? '#444' : '#D0D0D5',
    toolBtnBg: isDark ? '#383838' : '#FFFFFF',
    toolBtnBorder: isDark ? '#3A3A3A' : '#E0E0E5',
    menuBtnBg: isDark ? '#383838' : '#F0F0F3',
    menuDialogBg: isDark ? '#1E1E1E' : '#FFFFFF',
    overlayBg: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
  };

  const loadData = useCallback(async () => {
    try {
      const data = await contactDao.getLevel2Groups(bookId, level1Dir);
      setGroups(data);
      const total = data.reduce((sum, g) => sum + g.contacts.length, 0);
      setTotalCount(total);
      navigation.setOptions({ title: level1Dir });
    } catch (err) {
      console.error('加载二级目录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId, level1Dir]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openCreate = () => {
    setDialogMode('create');
    setDialogTitle('新建二级目录');
    setDialogText('');
    setDialogColorIdx(0);
    setShowDialog(true);
  };

  const openRename = (dirName: string, currentColorIdx: number) => {
    setDialogMode('rename');
    setDialogTitle('重命名二级目录');
    setDialogText(dirName);
    setDialogTarget(dirName);
    setDialogColorIdx(currentColorIdx >= 0 ? currentColorIdx : hashIndex(dirName, MorrisColors.length));
    setShowDialog(true);
  };

  const handleDialogConfirm = async () => {
    const text = dialogText.trim();
    if (!text) return;
    try {
      if (dialogMode === 'create') {
        await directoryDao.createLevel2Dir(bookId, level1Dir, text);
        await directoryDao.setDirColor(bookId, 2, level1Dir, text, dialogColorIdx);
      } else {
        await directoryDao.renameLevel2Dir(bookId, level1Dir, dialogTarget, text);
        await directoryDao.setDirColor(bookId, 2, level1Dir, text, dialogColorIdx);
      }
      setShowDialog(false);
      await loadData();
    } catch (err) {
      console.error('操作失败:', err);
    }
  };

  const handleDelete = (dirName: string, count: number) => {
    Alert.alert(
      '⚠ 删除二级目录',
      `确定要删除「${dirName}」吗？\n\n将删除其中 ${count} 个联系人，不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: () => {
            Alert.alert('最后确认', `真的要删除「${dirName}」吗？`, [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: async () => {
                  await directoryDao.deleteLevel2Dir(bookId, level1Dir, dirName);
                  await loadData();
                  contactDao.cleanupOrphans().catch(() => {});
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const handleMoveUp = async (dirName: string) => {
    await directoryDao.moveDirUp(bookId, 2, level1Dir, dirName);
    await loadData();
  };

  const handleMoveDown = async (dirName: string) => {
    await directoryDao.moveDirDown(bookId, 2, level1Dir, dirName);
    await loadData();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screen }]}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.editToggle, { backgroundColor: theme.toggle, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
          onPress={async () => {
            if (!editMode) {
              await directoryDao.syncAllDirOrders(bookId);
              // 进入编辑模式时折叠所有手风琴
              setExpandedGroups(new Set());
            }
            if (editMode && contactReorderMode) { setContactReorderMode(false); setEditMode(false); } else { setEditMode(!editMode); }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={editMode ? 'check' : 'edit'} size={18} />
            <Text style={{ fontSize: 16, color: theme.textPrimary }}>{editMode ? ' 完成' : ' 编辑'}</Text>
          </View>
        </Pressable>
        {editMode && (
          <Pressable
            style={({ pressed }) => [styles.editToggle, { backgroundColor: theme.toggle, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            onPress={() => setContactReorderMode(!contactReorderMode)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={contactReorderMode ? 'business' : 'people'} size={14} />
              <Text style={{ fontSize: 14, color: theme.textPrimary }}>{contactReorderMode ? ' 组织排序' : ' 联系人排序'}</Text>
            </View>
          </Pressable>
        )}
        <View style={styles.toolActions}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { backgroundColor: theme.toolBtnBg, borderColor: theme.toolBtnBorder }, pressed && { opacity: 0.6 }]}
            onPress={() => router.push(`/book/${bookId}/search`)}
          >
            <Icon name="search" size={18} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { backgroundColor: theme.toolBtnBg, borderColor: theme.toolBtnBorder }, pressed && { opacity: 0.6 }]}
            onPress={() => setShowNewMenu(true)}
          >
            <Icon name="add" size={18} />
          </Pressable>
        </View>
      </View>

      {editMode && (
        <View style={[styles.editHint, { backgroundColor: theme.editHintBg, borderBottomColor: theme.editHintBorder }]}>
          <Text style={{ fontSize: 12, color: '#FF9500' }}>
            长按拖拽排序 · 右划编辑/删除 · 点击展开
          </Text>
        </View>
      )}
      <Text style={[styles.summary, { color: theme.textSecondary }]}>
        {level1Dir} · {groups.length} 个部门 · {totalCount} 人
      </Text>

      {contactReorderMode ? (
        <ContactReorderView bookId={bookId} level1Dir={level1Dir} groups={groups} onSaved={() => { loadData(); setContactReorderMode(false); }} theme={theme} />
      ) : editMode ? (
        <View style={styles.body}>
          <DraggableFlatList
            bounces={true}
            alwaysBounceVertical={true}
            data={groups}
            keyExtractor={(item) => item.level2Dir}
            onDragEnd={async ({ data }) => {
              const db = await (await import('@/db/database')).getDatabase();
              for (let i = 0; i < data.length; i++) {
                const exists = await db.getFirstAsync<{ id: number }>(
                  `SELECT id FROM directory_order WHERE address_book_id = ? AND level = 2 AND parent_dir = ? AND dir_name = ?`,
                  [bookId, level1Dir, data[i].level2Dir],
                );
                if (exists) {
                  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [i, exists.id]);
                } else {
                  await db.runAsync(
                    `INSERT INTO directory_order (address_book_id, level, parent_dir, dir_name, sort_order) VALUES (?, 2, ?, ?, ?)`,
                    [bookId, level1Dir, data[i].level2Dir, i],
                  );
                }
              }
              setGroups(data);
            }}
            renderItem={({ item, drag, isActive }) => {
              const color = getMorrisColorForTheme(
                item.colorIndex >= 0 ? item.colorIndex : hashIndex(item.level2Dir, MorrisColors.length),
                isDark
              );
              const isExpanded = expandedGroups.has(item.level2Dir);
              const hasSubItems = item.contacts.length > 0;
              const dynamicShape = (isExpanded && hasSubItems)
                ? { borderTopStartRadius: 12, borderTopEndRadius: 12, borderBottomStartRadius: 0, borderBottomEndRadius: 0 }
                : 12;
              return (
                <UnifiedSwipeableWrapper
                  enabled
                  style={[styles.dirRow, isActive && { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }]}
                  cardBackgroundColor={color.bg}
                  borderRadius={dynamicShape}
                  onEdit={() => openRename(item.level2Dir, item.colorIndex)}
                  onDelete={() => handleDelete(item.level2Dir, item.contacts.length)}
                >
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
                    headerOnLongPress={drag}
                    containerStyle={
                      isExpanded && hasSubItems
                        ? { marginBottom: 0, borderBottomStartRadius: 0, borderBottomEndRadius: 0 }
                        : { marginBottom: 0 }
                    }
                  >
                    {item.contacts.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onPress={() => {}}
                        backgroundColor={getContactBg(color.bg, isDark)}
                      />
                    ))}
                  </AccordionSection>
                </UnifiedSwipeableWrapper>
              );
            }}
          />
          <View style={{ height: 24 }} />
        </View>
      ) : (
        <AccordionStickyView
          groups={groups}
          bookId={bookId}
          level1Dir={level1Dir}
          expandedGroups={expandedGroups}
          onToggleExpand={(dir) => setExpandedGroups(prev => { const next = new Set(prev); if (next.has(dir)) next.delete(dir); else next.add(dir); return next; })}
          theme={theme}
        />
      )}

      {/* 新建菜单弹窗 */}
      {showNewMenu && (
        <View style={[styles.overlay, { backgroundColor: theme.overlayBg }]}>
          <View style={[styles.menuDialog, { backgroundColor: theme.menuDialogBg }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>新建</Text>
            <View style={styles.menuGroup}>
              <Pressable
                style={({ pressed }) => [styles.menuBtn, { backgroundColor: theme.menuBtnBg }, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  setShowNewMenu(false);
                  router.push(
                    `/book/${bookId}/contact/new?l1=${encodeURIComponent(level1Dir)}`,
                  );
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="person-add" size={18} />
                  <Text style={[styles.menuBtnText, { color: theme.textPrimary }]}> 新建联系人</Text>
                </View>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.menuBtn, { backgroundColor: theme.menuBtnBg }, pressed && { opacity: 0.6 }]} onPress={() => { setShowNewMenu(false); openCreate(); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="create-new-folder" size={18} />
                  <Text style={[styles.menuBtnText, { color: theme.textPrimary }]}> 新建二级目录</Text>
                </View>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.menuCancel, pressed && { opacity: 0.6 }]}
              onPress={() => setShowNewMenu(false)}
            >
              <Text style={{ fontSize: 16, color: theme.textSecondary }}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 弹窗（重命名+排序） */}
      {showDialog && (
        <View style={[styles.overlay, { backgroundColor: theme.overlayBg }]}>
          <View style={[styles.dialog, { backgroundColor: theme.dialogBg }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>{dialogTitle}</Text>
            <TextInput
              style={[styles.dialogInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={dialogText}
              onChangeText={setDialogText}
              placeholder="请输入目录名称"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: Spacing.two }}>
              选择主题色：
            </Text>
            <View style={styles.colorRow}>
              {MorrisColors.map((mc, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.colorDot,
                    { backgroundColor: mc.bg },
                    dialogColorIdx === i && styles.colorDotSelected,
                  ]}
                  onPress={() => setDialogColorIdx(i)}
                />
              ))}
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                style={({ pressed }) => [styles.dialogCancel, pressed && { opacity: 0.6 }]}
                onPress={() => setShowDialog(false)}
              >
                <Text style={{ fontSize: 16, color: theme.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.dialogConfirm, pressed && { opacity: 0.8 }]}
                onPress={handleDialogConfirm}
              >
                <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                  确定
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  editToggle: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
  },
  editHint: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  toolActions: { flexDirection: 'row', gap: Spacing.two },
  toolBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  toolIcon: { fontSize: 18 },
  summary: {
    fontSize: 13,
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.two,
  },
  body: { flex: 1, paddingHorizontal: Spacing.four },
  dirRow: { marginBottom: Spacing.three },
  editActions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    gap: Spacing.one, paddingBottom: Spacing.one,
  },
  iconSm: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.four,
    justifyContent: 'center',
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#208AEF',
    borderWidth: 3,
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    paddingBottom: 56, zIndex: 10,
  },
  menuDialog: {
    borderRadius: 16,
    padding: Spacing.four,
    width: '80%',
    maxWidth: 300,
  },
  menuGroup: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  menuBtn: {
    paddingVertical: Spacing.two + Spacing.one,
    alignItems: 'center',
  },
  menuBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuCancel: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  dialog: {
    borderRadius: 16,
    padding: Spacing.four, width: '80%', maxWidth: 320,
  },
  dialogTitle: {
    fontSize: 18, fontWeight: '600', marginBottom: Spacing.four, textAlign: 'center',
  },
  dialogInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16, marginBottom: Spacing.four,
  },
  dialogActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two,
  },
  dialogCancel: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  dialogConfirm: {
    paddingVertical: Spacing.two, paddingHorizontal: Spacing.four,
    backgroundColor: '#208AEF', borderRadius: 10,
  },
  addContactBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.one,
  },
});
