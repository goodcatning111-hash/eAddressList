import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon } from '@/components/icon';
import { importFile, exportJSON, shareTemplate } from '@/utils/import-export';
import {
  getAllSlots,
  saveSlot,
  loadSlot,
  deleteSlot,
  type SaveSlotMeta,
  type SaveData,
} from '@/utils/save-manager';
import { exportFullData, importFullData } from '@/db/dao/full-backup-dao';
import { Spacing } from '@/constants/theme';
import { useTheme, type ThemeMode } from '@/contexts/theme';
import * as addressBookDao from '@/db/dao/address-book-dao';
import * as contactDao from '@/db/dao/contact-dao';
import type { AddressBook } from '@/db/types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { mode, setMode, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<AddressBook[]>([]);
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [slotMode, setSlotMode] = useState<'save' | 'load' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStep, setExportStep] = useState<'books' | 'style'>('books');
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [totalContacts, setTotalContacts] = useState(0);
  const [bookBreakdown, setBookBreakdown] = useState<string[]>([]);
  const [hasOrphans, setHasOrphans] = useState(false);

  // Dark mode theme colours
  const t = {
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#2A2A2A' : '#FFFFFF',
    toggle: isDark ? '#383838' : '#F0F0F3',
    textSecondary: isDark ? '#AAA' : '#808080',
    textTertiary: isDark ? '#888' : '#A0A0A0',
    textPrimary: isDark ? '#E0E0E0' : '#000000',
    border: isDark ? '#3A3A3A' : '#E0E0E0',
    slotPanelBg: isDark ? '#2A2A2A' : '#FFFFFF',
    slotRowBorder: isDark ? '#3A3A3A' : '#E0E0E5',
    slotFilledBg: isDark ? '#152535' : '#F0F7FF',
    rowBg: isDark ? '#2A2A2A' : '#FFFFFF',
    menuDialogBg: isDark ? '#2A2A2A' : '#FFFFFF',
    menuBtnBg: isDark ? '#383838' : '#F0F0F3',
    aboutBg: isDark ? '#2A2A2A' : '#FFFFFF',
    warnBg: isDark ? '#332A00' : '#FFF3CD',
    warnText: isDark ? '#FFD700' : '#856404',
    slotRowSummary: isDark ? '#AAA' : '#808080',
    slotRowDate: isDark ? '#888' : '#A0A0A0',
    slotRowEmpty: isDark ? '#666' : '#C0C0C0',
    arrow: isDark ? '#555' : '#C0C0C0',
    overlayBg: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
  };

  /** 静默自动清理——导入/删除后后台执行，0 结果时不弹窗 */
  const runAutoCleanup = async () => {
    try {
      const [dup, orphan] = await Promise.all([
        contactDao.cleanupDuplicates(),
        contactDao.cleanupOrphans(),
      ]);
      const total = dup + orphan.placeholders + orphan.orphans;
      if (total > 0) {
        const parts: string[] = [];
        if (dup > 0) parts.push(`重复 ${dup} 条`);
        if (orphan.placeholders > 0) parts.push(`占位 ${orphan.placeholders} 条`);
        if (orphan.orphans > 0) parts.push(`多余 ${orphan.orphans} 条`);
        Alert.alert('已自动清理', `移除 ${total} 条数据（${parts.join(' · ')}）`);
      }
    } catch { /* 静默忽略 */ }
  };

  const loadData = useCallback(async () => {
    try {
      const [bookList, slotList, bookCounts] = await Promise.all([
        addressBookDao.getAll(),
        getAllSlots(),
        contactDao.countByBook(),
      ]);
      setBooks(bookList);
      setSlots(slotList);
      setTotalContacts(bookCounts.reduce((sum, b) => sum + b.count, 0));
      setBookBreakdown(
        bookCounts.map((b) => `${b.bookName}：${b.count} 条`),
      );
      setHasOrphans(bookCounts.some((b) => b.bookId === 0 || b.bookName.includes('已删除')));
    } catch (err) {
      console.error('加载设置页失败:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // ── 导入 ──────────────────────────────────────────────

  const handleImport = async () => {
    const currentBooks = await addressBookDao.getAll();
    if (currentBooks.length === 0) {
      setLoading(true);
      try {
        const count = await importFile();
        setLoading(false);
        if (count > 0) { Alert.alert('导入成功', `已导入 ${count} 个联系人`); await loadData(); await runAutoCleanup(); }
      } catch { setLoading(false); }
      return;
    }
    if (currentBooks.length === 1) {
      setLoading(true);
      try {
        const count = await importFile(currentBooks[0].id);
        setLoading(false);
        if (count > 0) { Alert.alert('导入成功', `已导入 ${count} 个联系人到「${currentBooks[0].name}」`); await loadData(); await runAutoCleanup(); }
      } catch { setLoading(false); }
      return;
    }
    const bookOptions: any[] = currentBooks.map((b) => ({
      text: `${b.name} (${b.contactCount}人)`,
      onPress: async () => {
        setLoading(true);
        try {
          const count = await importFile(b.id);
          setLoading(false);
          if (count > 0) { Alert.alert('导入成功', `已导入 ${count} 个联系人到「${b.name}」`); await loadData(); await runAutoCleanup(); }
        } catch { setLoading(false); }
      },
    }));
    bookOptions.push({ text: '取消', style: 'cancel' });
    Alert.alert('选择导入目标', '请选择要将数据导入到哪个通讯簿：', bookOptions);
  };

  // ── 存档 ──────────────────────────────────────────────

  const handleSave = (index: number, meta: SaveSlotMeta) => {
    const doSave = async () => {
      setLoading(true);
      try {
        const data = await exportFullData();
        await saveSlot(index, data);
        setLoading(false);
        Alert.alert('存档成功', `已保存到存档位 ${index + 1}`);
        await loadData();
      } catch (err) {
        setLoading(false);
        console.error('存档失败:', err);
      }
    };

    if (meta.hasData) {
      Alert.alert(
        '覆盖存档',
        `存档位 ${index + 1} 已有数据（${meta.summary}）。\n是否覆盖？此操作不可撤销。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '覆盖', style: 'destructive', onPress: doSave },
        ],
      );
    } else {
      doSave();
    }
  };

  // ── 读档 ──────────────────────────────────────────────

  const handleLoad = (index: number, meta: SaveSlotMeta) => {
    if (!meta.hasData) return;

    Alert.alert(
      '读取存档',
      `确定要加载存档位 ${index + 1} 吗？\n\n${meta.summary}\n存档时间：${new Date(meta.savedAt).toLocaleString()}\n\n⚠ 当前数据将被完全替换，此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认读取',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const data = await loadSlot(index);
              await importFullData(data);
              setLoading(false);
              Alert.alert('读档成功', '数据已恢复，请返回首页查看');
              await loadData();
            } catch (err) {
              setLoading(false);
              console.error('读档失败:', err);
              Alert.alert('读档失败', '存档文件可能已损坏');
            }
          },
        },
      ],
    );
  };

  // ── 删除存档 ──────────────────────────────────────────

  const handleDeleteSlot = (index: number, meta: SaveSlotMeta) => {
    if (!meta.hasData) return;
    Alert.alert(
      '删除存档',
      `确定要删除存档位 ${index + 1} 的数据吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteSlot(index);
            await loadData();
          },
        },
      ],
    );
  };

  // ── 导出 ──────────────────────────────────────────────

  const handleExport = async (bookIds: number[], includeStyles: boolean) => {
    setLoading(true);
    const allSelected = bookIds.length === books.length;
    if (allSelected) {
      await exportJSON({ includeStyles });
    } else if (bookIds.length === 1) {
      await exportJSON({ bookId: bookIds[0], includeStyles });
    } else {
      // 多选（非全选）：导出全部但只含选中的通讯簿
      await exportJSON({ bookIds, includeStyles });
    }
    setLoading(false);
  };

  const openExportMenu = () => {
    setSelectedBookIds(new Set(books.map((b) => b.id))); // 默认全选
    setExportStep('books');
    setShowExportMenu(true);
  };

  const toggleBookSelection = (id: number) => {
    const next = new Set(selectedBookIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    // 至少选一个
    if (next.size === 0) return;
    setSelectedBookIds(next);
  };

  const selectAllBooks = () => {
    setSelectedBookIds(new Set(books.map((b) => b.id)));
  };

  // ── 清理 ──────────────────────────────────────────────

  const handleCleanup = () => {
    Alert.alert(
      '清理数据',
      '将执行两项操作：\n'
        + '1. 合并同姓名、同目录的重复联系人（保留最新）\n'
        + '2. 删除占位联系人「（待添加）」及多余数据\n\n'
        + '此操作不可撤销，确定继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定清理',
          onPress: async () => {
            setLoading(true);
            try {
              const [dupRemoved, orphanResult] = await Promise.all([
                contactDao.cleanupDuplicates(),
                contactDao.cleanupOrphans(),
              ]);
              setLoading(false);
              const total = dupRemoved + orphanResult.placeholders + orphanResult.orphans;
              if (total > 0) {
                const parts: string[] = [];
                if (dupRemoved > 0) parts.push(`重复：${dupRemoved} 条`);
                if (orphanResult.placeholders > 0) parts.push(`占位：${orphanResult.placeholders} 条`);
                if (orphanResult.orphans > 0) parts.push(`多余：${orphanResult.orphans} 条`);
                Alert.alert('清理完成', `已移除 ${total} 条数据\n（${parts.join(' · ')}）`);
              } else {
                Alert.alert('无需清理', '未发现重复或冗余数据');
              }
              await loadData();
            } catch (err) {
              setLoading(false);
              console.error('清理失败:', err);
            }
          },
        },
      ],
    );
  };

  // ── Loading ───────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.screen }]}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={[styles.loadingText, { color: t.textSecondary }]}>处理中...</Text>
      </View>
    );
  }

  // ── UI ────────────────────────────────────────────────

  return (
    <ScrollView style={[styles.screen, { backgroundColor: t.screen }]} bounces={true} alwaysBounceVertical={true}>
      {/* ── 数据管理 ── */}
      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>数据管理</Text>

      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: t.rowBg, borderBottomColor: t.border }, pressed && { opacity: 0.6 }]} onPress={() => { loadData(); setSlotMode('save'); }}>
        <View style={styles.rowLeft}>
          <Icon name="save" size={28} style={{ marginRight: Spacing.three }} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.textPrimary }]}>存档</Text>
            <Text style={[styles.rowDesc, { color: t.textSecondary }]}>将当前全部数据保存到本地档位</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={t.arrow} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: t.rowBg, borderBottomColor: t.border }, pressed && { opacity: 0.6 }]} onPress={() => { loadData(); setSlotMode('load'); }}>
        <View style={styles.rowLeft}>
          <Icon name="folder-open" size={28} style={{ marginRight: Spacing.three }} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.textPrimary }]}>读档</Text>
            <Text style={[styles.rowDesc, { color: t.textSecondary }]}>从本地档位恢复数据（当前数据将被替换）</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={t.arrow} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: t.rowBg, borderBottomColor: t.border }, pressed && { opacity: 0.6 }]} onPress={handleImport}>
        <View style={styles.rowLeft}>
          <Icon name="file-download" size={28} style={{ marginRight: Spacing.three }} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.textPrimary }]}>导入数据</Text>
            <Text style={[styles.rowDesc, { color: t.textSecondary }]}>支持 Excel (.xlsx)、CSV (.csv)、JSON 备份恢复</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={t.arrow} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: t.rowBg, borderBottomColor: t.border }, pressed && { opacity: 0.6 }]} onPress={openExportMenu}>
        <View style={styles.rowLeft}>
          <Icon name="file-upload" size={28} style={{ marginRight: Spacing.three }} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.textPrimary }]}>导出 JSON 备份</Text>
            <Text style={[styles.rowDesc, { color: t.textSecondary }]}>选择通讯簿和样式后导出为 JSON 文件</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={t.arrow} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: t.rowBg, borderBottomColor: t.border }, pressed && { opacity: 0.6 }]} onPress={() => shareTemplate().catch(() => {})}>
        <View style={styles.rowLeft}>
          <Icon name="description" size={28} style={{ marginRight: Spacing.three }} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: t.textPrimary }]}>下载导入模板</Text>
            <Text style={[styles.rowDesc, { color: t.textSecondary }]}>下载 Excel 模板文件，按格式填写后导入</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={t.arrow} />
      </Pressable>

      <View style={[styles.aboutRow, { backgroundColor: t.aboutBg, borderBottomColor: t.border }]}>
        <Text style={[styles.aboutText, { color: t.textSecondary }]}>
          数据库共 {totalContacts} 条联系人记录（{bookBreakdown.join(' · ')}）
        </Text>
      </View>

      {hasOrphans && (
        <View style={[styles.warnRow, { backgroundColor: t.warnBg }]}>
          <Text style={[styles.warnText, { color: t.warnText }]}>
            <Icon name="warning" size={18} color={t.warnText} /> 检测到部分联系人未关联到任何通讯簿，请执行「清理数据」
          </Text>
        </View>
      )}

      {/* ── 外观 ── */}
      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>外观</Text>
      <View style={[styles.themeRow, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <Text style={[styles.rowTitle, { color: t.textPrimary }]}>主题模式</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => {
            const active = mode === m;
            const iconName = m === 'light' ? 'light-mode' as const : m === 'dark' ? 'dark-mode' as const : 'phone-android' as const;
            const label = m === 'light' ? ' 浅色' : m === 'dark' ? ' 深色' : ' 跟随系统';
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={({ pressed }) => [
                  { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? '#208AEF' : t.toggle },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name={iconName} size={18} color={active ? '#FFF' : t.textTertiary} />
                  <Text style={{ fontSize: 13, color: active ? '#FFF' : t.textTertiary }}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>关于</Text>
      <View style={[styles.aboutRow, { backgroundColor: t.aboutBg, borderBottomColor: t.border }]}>
        <Text style={[styles.aboutText, { color: t.textSecondary }]}>版本 1.0.0</Text>
        <Text style={[styles.aboutText, { color: t.textSecondary }]}>eAddressList 电子通讯录</Text>
      </View>

      <View style={{ height: 60 }} />

      {/* ── 档位选择 Overlay ── */}
      {slotMode !== null && (
        <View style={[styles.overlay, { backgroundColor: t.overlayBg }]}>
          <View style={[styles.slotPanel, { backgroundColor: t.slotPanelBg }]}>
            <View style={styles.slotPanelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <Icon name={slotMode === 'save' ? 'save' : 'folder-open'} size={28} />
                <Text style={[styles.slotPanelTitle, { color: t.textPrimary }]}>
                  {slotMode === 'save' ? ' 选择存档位' : ' 选择读档位'}
                </Text>
              </View>
              <Pressable onPress={() => setSlotMode(null)}>
                <Icon name="close" size={22} color={t.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.slotPanelHint, { color: t.textSecondary }]}>
              {slotMode === 'save'
                ? '存档包含全部数据（排序、颜色、收藏）。点击已有档位将覆盖。'
                : '读档将替换当前全部数据，请谨慎操作。'}
            </Text>
            {slots.map((slot) => (
              <Pressable
                key={slot.index}
                style={({ pressed }) => [
                  styles.slotRow,
                  { borderColor: t.slotRowBorder },
                  slot.hasData && { borderColor: '#208AEF', backgroundColor: t.slotFilledBg },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  setSlotMode(null);
                  if (slotMode === 'save') {
                    handleSave(slot.index, slot);
                  } else {
                    handleLoad(slot.index, slot);
                  }
                }}
              >
                <Icon name={slot.hasData ? 'save' : 'folder'} size={28} style={{ marginRight: Spacing.three }} />
                <View style={styles.slotRowText}>
                  <Text style={[styles.slotRowLabel, { color: t.textPrimary }]}>存档位 {slot.index + 1}</Text>
                  {slot.hasData ? (
                    <>
                      <Text style={[styles.slotRowSummary, { color: t.slotRowSummary }]}>{slot.summary}</Text>
                      <Text style={[styles.slotRowDate, { color: t.slotRowDate }]}>
                        {new Date(slot.savedAt).toLocaleString()}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.slotRowEmpty, { color: t.slotRowEmpty }]}>
                      {slotMode === 'save' ? '点击存档' : '空'}
                    </Text>
                  )}
                </View>
                {slot.hasData && slotMode === 'load' && (
                  <Pressable
                    style={({ pressed }) => [styles.slotDeleteBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => {
                      setSlotMode(null);
                      handleDeleteSlot(slot.index, slot);
                    }}
                  >
                    <Icon name="delete" size={22} color="#FF3B30" />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── 导出向导 Overlay ── */}
      {showExportMenu && (
        <View style={[styles.overlayCenter, { backgroundColor: t.overlayBg }]}>
          <View style={[styles.menuDialog, { backgroundColor: t.menuDialogBg }]}>
            {exportStep === 'books' ? (
              <>
                <Text style={[styles.dialogTitle, { color: t.textPrimary }]}>选择要导出的通讯簿</Text>
                <Pressable style={({ pressed }) => [styles.selectAllBtn, pressed && { opacity: 0.6 }]} onPress={selectAllBooks}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name={selectedBookIds.size === books.length ? 'check-box' : 'check-box-outline-blank'} size={18} color="#208AEF" />
                    <Text style={styles.selectAllText}>{selectedBookIds.size === books.length ? ' 已全选' : ' 全选'}</Text>
                  </View>
                </Pressable>
                <View style={styles.menuGroup}>
                  {books.map((b) => (
                    <Pressable
                      key={b.id}
                      style={({ pressed }) => [styles.menuBtn, { backgroundColor: t.menuBtnBg }, pressed && { opacity: 0.6 }]}
                      onPress={() => toggleBookSelection(b.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name={selectedBookIds.has(b.id) ? 'check-box' : 'check-box-outline-blank'} size={18} color="#208AEF" />
                        <Text style={[styles.menuBtnText, { color: t.textPrimary }]}>
                          {b.name}（{b.contactCount} 人）
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.dialogActions}>
                  <Pressable
                    style={({ pressed }) => [styles.dialogCancel, pressed && { opacity: 0.6 }]}
                    onPress={() => setShowExportMenu(false)}
                  >
                    <Text style={{ fontSize: 16, color: t.textSecondary }}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.dialogConfirm, pressed && { opacity: 0.8 }]}
                    onPress={() => setExportStep('style')}
                  >
                    <Text style={styles.dialogConfirmText}>下一步</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.dialogTitle, { color: t.textPrimary }]}>导出格式</Text>
                <Text style={{ fontSize: 13, color: t.textSecondary, marginBottom: Spacing.four, textAlign: 'center' }}>
                  已选 {selectedBookIds.size} 个通讯簿
                </Text>
                <View style={styles.menuGroup}>
                  <Pressable
                    style={({ pressed }) => [styles.menuBtn, { backgroundColor: t.menuBtnBg }, pressed && { opacity: 0.6 }]}
                    onPress={() => {
                      setShowExportMenu(false);
                      setExportStep('books');
                      handleExport(Array.from(selectedBookIds), true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="palette" size={18} />
                      <Text style={[styles.menuBtnText, { color: t.textPrimary }]}> 含颜色样式</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.menuBtn, { backgroundColor: t.menuBtnBg }, pressed && { opacity: 0.6 }]}
                    onPress={() => {
                      setShowExportMenu(false);
                      setExportStep('books');
                      handleExport(Array.from(selectedBookIds), false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="description" size={18} />
                      <Text style={[styles.menuBtnText, { color: t.textPrimary }]}> 纯数据（无样式）</Text>
                    </View>
                  </Pressable>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.menuCancel, pressed && { opacity: 0.6 }]}
                  onPress={() => setExportStep('books')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="arrow-back" size={16} color={t.textSecondary} />
                    <Text style={{ fontSize: 16, color: t.textSecondary }}> 返回上一步</Text>
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.two, fontSize: 15 },

  // sections
  themeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.three, paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  sectionTip: {
    fontSize: 12,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    lineHeight: 17,
  },

  // slot overlay
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  overlayCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.four, textAlign: 'center' },
  slotPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  slotPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  slotPanelTitle: { fontSize: 18, fontWeight: '700' },
  slotPanelHint: {
    fontSize: 12,
    marginBottom: Spacing.three,
    lineHeight: 17,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.one,
    borderWidth: 1,
  },
  slotRowIcon: { fontSize: 28, marginRight: Spacing.three },
  slotRowText: { flex: 1 },
  slotRowLabel: { fontSize: 15, fontWeight: '600' },
  slotRowSummary: { fontSize: 12, marginTop: 2 },
  slotRowDate: { fontSize: 11, marginTop: 1 },
  slotRowEmpty: { fontSize: 12, marginTop: 2 },
  slotDeleteBtn: { padding: Spacing.two },

  // rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three + Spacing.half,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { fontSize: 28, marginRight: Spacing.three },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowDesc: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 12 },

  // about
  aboutRow: {
    paddingVertical: Spacing.three + Spacing.half,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  aboutText: { fontSize: 14 },
  menuDialog: {
    borderRadius: 16,
    padding: Spacing.four,
    width: '85%',
    maxWidth: 340,
    maxHeight: '80%',
  },
  menuGroup: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  menuBtn: {
    paddingVertical: Spacing.two + Spacing.one,
    alignItems: 'center',
  },
  menuBtnText: { fontSize: 15, fontWeight: '500' },
  menuCancel: { paddingVertical: Spacing.two, alignItems: 'center', marginTop: Spacing.one },
  selectAllBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  selectAllText: { fontSize: 14, fontWeight: '600', color: '#208AEF' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.three },
  dialogCancel: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  dialogConfirm: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, backgroundColor: '#208AEF', borderRadius: 10 },
  dialogConfirmText: { fontSize: 16, color: '#FFFFFF', fontWeight: '600' },
  warnRow: {
    marginHorizontal: Spacing.four,
    borderRadius: 8,
    padding: Spacing.two + Spacing.half,
    marginBottom: Spacing.three,
  },
  warnText: { fontSize: 13, textAlign: 'center' },
});
