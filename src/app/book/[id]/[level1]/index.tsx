import { useState, useCallback } from 'react';
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
import { AccordionSection } from '@/components/ui/accordion-section';
import { UnifiedSwipeableWrapper } from '@/components/ui/swipeable-row';
import { ContactRow } from '@/components/contact-row';
import { getMorrisColor, hashIndex, MorrisColors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import * as contactDao from '@/db/dao/contact-dao';
import * as directoryDao from '@/db/dao/directory-dao';
import type { Level2Group } from '@/db/types';

/** 页面 3：二级目录手风琴 + 联系人列表 — 支持编辑模式 */
export default function Level2Screen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, level1 } = useLocalSearchParams<{ id: string; level1: string }>();
  const bookId = Number(id);
  const level1Dir = decodeURIComponent(level1 ?? '');

  const [groups, setGroups] = useState<Level2Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 弹窗
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'rename'>('create');
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogText, setDialogText] = useState('');
  const [dialogTarget, setDialogTarget] = useState('');
  const [dialogColorIdx, setDialogColorIdx] = useState(0);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <Pressable
          style={styles.editToggle}
          onPress={async () => {
            if (!editMode) {
              await directoryDao.syncAllDirOrders(bookId);
              // 进入编辑模式时折叠所有手风琴
              setExpandedGroups(new Set());
            }
            setEditMode(!editMode);
          }}
        >
          <Text style={{ fontSize: 16 }}>{editMode ? '🔓 完成' : '🔒 编辑'}</Text>
        </Pressable>
        <View style={styles.toolActions}>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/book/${bookId}/search`)}
          >
            <Text style={styles.toolIcon}>🔍</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => setShowNewMenu(true)}
          >
            <Text style={styles.toolIcon}>＋</Text>
          </Pressable>
        </View>
      </View>

      {editMode && (
        <View style={styles.editHint}>
          <Text style={{ fontSize: 12, color: '#FF9500' }}>
            长按拖拽排序 · 右划编辑/删除 · 点击展开
          </Text>
        </View>
      )}
      <Text style={styles.summary}>
        {level1Dir} · {groups.length} 个部门 · {totalCount} 人
      </Text>

      {editMode ? (
        <View style={styles.body}>
          <DraggableFlatList
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
              const color = item.colorIndex >= 0
                ? getMorrisColor(item.colorIndex)
                : getMorrisColor(hashIndex(item.level2Dir, MorrisColors.length));
              const isExpanded = expandedGroups.has(item.level2Dir);
              const hasSubItems = item.contacts.length > 0;
              // Principle 1 (Shape Inheritance): dynamic shape per spec §3.2.
              // Top-rounded + bottom-flat when expanded, uniform when collapsed.
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
                    headerOnLongPress={() => drag()}
                    // Principle 2 (Zero-Gap): suppress internal margin.
                    // Match bottom corners to dynamic shape so inner & outer masks align.
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
        <ScrollView style={styles.body}>
          {groups.map((group) => {
            const color = group.colorIndex >= 0
              ? getMorrisColor(group.colorIndex)
              : getMorrisColor(hashIndex(group.level2Dir, MorrisColors.length));
            return (
              <View key={group.level2Dir} style={styles.dirRow}>
                <AccordionSection
                  title={group.level2Dir}
                  count={group.contacts.length}
                  bgColor={color.bg}
                  fgColor={color.fg}
                  containerStyle={{ marginBottom: 0 }}
                  footer={
                    <Pressable
                      style={styles.addContactBtn}
                      onPress={() =>
                        router.push(
                          `/book/${bookId}/contact/new?l1=${encodeURIComponent(level1Dir)}&l2=${encodeURIComponent(group.level2Dir)}`,
                        )
                      }
                    >
                      <Text style={{ fontSize: 15, color: '#208AEF' }}>
                        ＋ 新增联系人
                      </Text>
                    </Pressable>
                  }
                >
                  {group.contacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onPress={() =>
                        router.push(`/book/${bookId}/contact/${contact.id}`)
                      }
                    />
                  ))}
                </AccordionSection>
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* 新建菜单弹窗 */}
      {showNewMenu && (
        <View style={styles.overlay}>
          <View style={styles.menuDialog}>
            <Text style={styles.dialogTitle}>新建</Text>
            <View style={styles.menuGroup}>
              <Pressable
                style={styles.menuBtn}
                onPress={() => {
                  setShowNewMenu(false);
                  router.push(
                    `/book/${bookId}/contact/new?l1=${encodeURIComponent(level1Dir)}`,
                  );
                }}
              >
                <Text style={styles.menuBtnText}>👤 新建联系人</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => { setShowNewMenu(false); openCreate(); }}>
                <Text style={styles.menuBtnText}>📁 新建二级目录</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.menuCancel}
              onPress={() => setShowNewMenu(false)}
            >
              <Text style={{ fontSize: 16, color: '#808080' }}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 弹窗（重命名+排序） */}
      {showDialog && (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{dialogTitle}</Text>
            <TextInput
              style={styles.dialogInput}
              value={dialogText}
              onChangeText={setDialogText}
              placeholder="请输入目录名称"
              autoFocus
            />
            <Text style={{ fontSize: 13, color: '#808080', marginBottom: Spacing.two }}>
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
                style={styles.dialogCancel}
                onPress={() => setShowDialog(false)}
              >
                <Text style={{ fontSize: 16, color: '#808080' }}>取消</Text>
              </Pressable>
              <Pressable
                style={styles.dialogConfirm}
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
    backgroundColor: '#F0F0F3',
  },
  editHint: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#FFF8E1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFE0B2',
    alignItems: 'center',
  },
  toolActions: { flexDirection: 'row', gap: Spacing.two },
  toolBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E5',
  },
  toolIcon: { fontSize: 18 },
  summary: {
    fontSize: 13, color: '#808080',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E5',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  menuDialog: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F0F0F3',
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
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: Spacing.four, width: '80%', maxWidth: 320,
  },
  dialogTitle: {
    fontSize: 18, fontWeight: '600', marginBottom: Spacing.four, textAlign: 'center',
  },
  dialogInput: {
    borderWidth: 1, borderColor: '#D0D0D5', borderRadius: 10,
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
    borderTopColor: '#E0E0E0',
    marginTop: Spacing.one,
  },
});
