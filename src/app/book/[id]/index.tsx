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
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { DirectoryCard } from '@/components/directory-card';
import { UnifiedSwipeableWrapper } from '@/components/ui/swipeable-row';
import { getMorrisColor, hashIndex, MorrisColors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import * as contactDao from '@/db/dao/contact-dao';
import * as addressBookDao from '@/db/dao/address-book-dao';
import * as directoryDao from '@/db/dao/directory-dao';
import type { Level1Summary, AddressBook } from '@/db/types';

/** 页面 2：一级目录列表 — 支持编辑模式 */
export default function Level1Screen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);

  const [book, setBook] = useState<AddressBook | null>(null);
  const [dirs, setDirs] = useState<Level1Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

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
      const [bookData, dirData] = await Promise.all([
        addressBookDao.getById(bookId),
        contactDao.getLevel1Dirs(bookId),
      ]);
      setBook(bookData);
      setDirs(dirData);
      if (bookData) navigation.setOptions({ title: bookData.name });
    } catch (err) {
      console.error('加载一级目录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openCreate = () => {
    setDialogMode('create');
    setDialogTitle('新建一级目录');
    setDialogText('');
    setDialogColorIdx(0);
    setShowDialog(true);
  };

  const openRename = (dirName: string, currentColorIdx: number) => {
    setDialogMode('rename');
    setDialogTitle('重命名目录');
    setDialogText(dirName);
    setDialogTarget(dirName);
    // 使用已保存的颜色（≥0），否则回退到名称哈希色
    setDialogColorIdx(currentColorIdx >= 0 ? currentColorIdx : hashIndex(dirName, MorrisColors.length));
    setShowDialog(true);
  };

  const handleDialogConfirm = async () => {
    const text = dialogText.trim();
    if (!text) return;
    try {
      if (dialogMode === 'create') {
        await directoryDao.createLevel1Dir(bookId, text);
        await directoryDao.setDirColor(bookId, 1, '', text, dialogColorIdx);
      } else {
        await directoryDao.renameLevel1Dir(bookId, dialogTarget, text);
        await directoryDao.setDirColor(bookId, 1, '', text, dialogColorIdx);
      }
      setShowDialog(false);
      await loadData();
    } catch (err) {
      console.error('操作失败:', err);
    }
  };

  const handleDelete = (dirName: string, count: number) => {
    Alert.alert(
      '⚠ 删除目录',
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
                  await directoryDao.deleteLevel1Dir(bookId, dirName);
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
    await directoryDao.moveDirUp(bookId, 1, '', dirName);
    await loadData();
  };

  const handleMoveDown = async (dirName: string) => {
    await directoryDao.moveDirDown(bookId, 1, '', dirName);
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
            if (!editMode) await directoryDao.syncAllDirOrders(bookId);
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
            长按拖拽排序 · 右划编辑/删除
          </Text>
        </View>
      )}
      <Text style={styles.bookName}>{book?.name ?? '通讯簿'}</Text>

      {editMode ? (
        <View style={styles.body}>
          <DraggableFlatList
            data={dirs}
            keyExtractor={(item) => item.level1Dir}
            onDragEnd={async ({ data }) => {
              // 按新顺序更新 sort_order
              const db = await (await import('@/db/database')).getDatabase();
              for (let i = 0; i < data.length; i++) {
                const exists = await db.getFirstAsync<{ id: number }>(
                  `SELECT id FROM directory_order WHERE address_book_id = ? AND level = 1 AND parent_dir = '' AND dir_name = ?`,
                  [bookId, data[i].level1Dir],
                );
                if (exists) {
                  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [i, exists.id]);
                } else {
                  await db.runAsync(
                    `INSERT INTO directory_order (address_book_id, level, parent_dir, dir_name, sort_order) VALUES (?, 1, '', ?, ?)`,
                    [bookId, data[i].level1Dir, i],
                  );
                }
              }
              setDirs(data);
            }}
            renderItem={({ item, drag, isActive }) => {
              const color = item.colorIndex >= 0
                ? getMorrisColor(item.colorIndex)
                : getMorrisColor(hashIndex(item.level1Dir, MorrisColors.length));
              return (
                <UnifiedSwipeableWrapper
                  enabled
                  style={[styles.dirRow, isActive && { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }]}
                  cardBackgroundColor={color.bg}
                  borderRadius={14}
                  onEdit={() => openRename(item.level1Dir, item.colorIndex)}
                  onDelete={() => handleDelete(item.level1Dir, item.count)}
                >
                  <DirectoryCard
                    name={item.level1Dir}
                    count={item.count}
                    bgColor={color.bg}
                    fgColor={color.fg}
                    onPress={() => {}}
                    onLongPress={() => drag()}
                  />
                </UnifiedSwipeableWrapper>
              );
            }}
          />
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {dirs.map((dir) => {
            const color = dir.colorIndex >= 0
              ? getMorrisColor(dir.colorIndex)
              : getMorrisColor(hashIndex(dir.level1Dir, MorrisColors.length));
            return (
              <View key={dir.level1Dir} style={styles.dirRow}>
                <DirectoryCard
                  name={dir.level1Dir}
                  count={dir.count}
                  bgColor={color.bg}
                  fgColor={color.fg}
                  onPress={() =>
                    router.push(`/book/${bookId}/${encodeURIComponent(dir.level1Dir)}`)
                  }
                />
              </View>
            );
          })}
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
                  router.push(`/book/${bookId}/contact/new`);
                }}
              >
                <Text style={styles.menuBtnText}>👤 新建联系人</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => { setShowNewMenu(false); openCreate(); }}>
                <Text style={styles.menuBtnText}>📁 新建一级目录</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  toolIcon: { fontSize: 18 },
  bookName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  body: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  dirRow: { marginBottom: Spacing.three },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    paddingBottom: Spacing.one,
  },
  iconSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
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
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: Spacing.four,
    width: '80%',
    maxWidth: 320,
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
});
