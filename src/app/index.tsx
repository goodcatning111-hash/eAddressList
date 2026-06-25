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
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '@/components/icon';
import { AddressBookCard } from '@/components/address-book-card';
import { UnifiedSwipeableWrapper } from '@/components/ui/swipeable-row';
import { getMorrisColorForTheme, MorrisColors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import * as addressBookDao from '@/db/dao/address-book-dao';
import * as contactDao from '@/db/dao/contact-dao';
import { getBookColor } from '@/db/dao/address-book-dao';
import type { AddressBook } from '@/db/types';

/** 页面 1：通讯簿门户 — 展示所有通讯簿卡片，支持编辑模式 */
export default function PortalScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [books, setBooks] = useState<AddressBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<AddressBook | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameColorIdx, setRenameColorIdx] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AddressBook | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const loadBooks = useCallback(async () => {
    try {
      const list = await addressBookDao.getAll();
      setBooks(list);
    } catch (err) {
      console.error('加载通讯簿失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks]),
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('提示', '请输入通讯簿名称');
      return;
    }
    try {
      await addressBookDao.create(name);
      setNewName('');
      setShowCreate(false);
      await loadBooks();
    } catch (err) {
      console.error('创建通讯簿失败:', err);
      Alert.alert('错误', '创建失败，请重试');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameText.trim()) return;
    try {
      await addressBookDao.rename(renameTarget.id, renameText.trim());
      if (renameColorIdx >= 0) {
        await addressBookDao.setColor(renameTarget.id, renameColorIdx);
      }
      setRenameTarget(null);
      await loadBooks();
    } catch (err) {
      console.error('重命名失败:', err);
    }
  };

  const handleDelete = (book: AddressBook) => {
    Alert.alert(
      '⚠ 删除通讯簿',
      `确定要删除「${book.name}」吗？\n\n将删除其中 ${book.contactCount} 个联系人，此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: () => {
            setDeleteTarget(book);
            setDeleteConfirmText('');
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim() !== deleteTarget.name) {
      Alert.alert('已取消', '名称不匹配，删除已取消');
      setDeleteTarget(null);
      return;
    }
    try {
      await addressBookDao.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadBooks();
      contactDao.cleanupOrphans().catch(() => {});
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    await addressBookDao.swapOrder(books[index].id, books[index - 1].id);
    await loadBooks();
  };

  const handleMoveDown = async (index: number) => {
    if (index >= books.length - 1) return;
    await addressBookDao.swapOrder(books[index].id, books[index + 1].id);
    await loadBooks();
  };

  // Dark mode theme colours
  const theme = {
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#2A2A2A' : '#FFFFFF',
    toggle: isDark ? '#383838' : '#F0F0F3',
    toggleActive: isDark ? '#383838' : '#E8E8EC',
    textSecondary: isDark ? '#AAA' : '#808080',
    textTertiary: isDark ? '#888' : '#A0A0A0',
    textPrimary: isDark ? '#E0E0E0' : '#000000',
    border: isDark ? '#3A3A3A' : '#E0E0E0',
    headerBg: isDark ? '#1E1E1E' : '#FFFFFF',
    editHintBg: isDark ? '#2A2A2A' : '#FFF8E1',
    editHintBorder: isDark ? '#444' : '#FFE0B2',
    dialogBg: isDark ? '#1E1E1E' : '#FFFFFF',
    inputBg: isDark ? '#333' : '#FFFFFF',
    inputBorder: isDark ? '#444' : '#D0D0D5',
    overlayBg: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
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
      {/* 标题栏 */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>我的通讯录</Text>
          {!editMode && (
            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.6 }]}
              onPress={() => router.push('/search' as any)}
            >
              <Icon name="search" size={20} />
            </Pressable>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={({ pressed }) => [styles.editToggle, { backgroundColor: theme.toggle, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            onPress={() => setEditMode(!editMode)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={editMode ? 'check' : 'edit'} size={18} />
              <Text style={{ fontSize: 16, color: theme.textPrimary }}>
                {editMode ? ' 完成' : ' 编辑'}
              </Text>
            </View>
          </Pressable>
          {!editMode && (
            <Pressable onPress={() => router.push('/settings')} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Icon name="settings" size={26} />
            </Pressable>
          )}
        </View>
      </View>
      {editMode && (
        <View style={[styles.editHint, { backgroundColor: theme.editHintBg, borderBottomColor: theme.editHintBorder }]}>
          <Text style={{ fontSize: 12, color: '#FF9500' }}>
            长按拖拽排序 · 右划编辑/删除
          </Text>
        </View>
      )}

      {/* 通讯簿列表 */}
      {books.length === 0 ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.emptyContainer}
          bounces={true}
          alwaysBounceVertical={true}
        >
          <View style={styles.emptyState}>
            <Icon name="menu-book" size={64} secondary />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>暂无通讯簿</Text>
            <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>点击下方 + 按钮创建</Text>
          </View>
        </ScrollView>
      ) : editMode ? (
        <View style={styles.body}>
          <DraggableFlatList
            bounces={true}
            alwaysBounceVertical={true}
            data={books}
            keyExtractor={(item) => String(item.id)}
            onDragEnd={async ({ data }) => {
              await addressBookDao.reorderAll(data.map((b) => b.id));
              setBooks(data);
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<AddressBook>) => {
                const colorIdx = item.colorIndex >= 0 ? item.colorIndex : item.id;
                const cardColor = getMorrisColorForTheme(colorIdx, isDark);
                return (
                <UnifiedSwipeableWrapper
                  enabled
                  style={[styles.cardWrapper, isActive && styles.dragging]}
                  cardBackgroundColor={cardColor.bg}
                  borderRadius={16}
                  onEdit={() => {
                    setRenameTarget(item);
                    setRenameText(item.name);
                    setRenameColorIdx(item.colorIndex >= 0 ? item.colorIndex : item.id % MorrisColors.length);
                  }}
                  onDelete={() => handleDelete(item)}
                >
                  <AddressBookCard
                    book={item}
                    index={item.id}
                    onPress={() => {}}
                    onLongPress={drag}
                  />
                </UnifiedSwipeableWrapper>
                );
            }}
          />
        </View>
      ) : (
        <ScrollView style={styles.body} bounces={true} alwaysBounceVertical={true}>
          {books.map((book) => (
            <View key={book.id} style={styles.cardWrapper}>
              <AddressBookCard
                book={book}
                index={book.id}
                onPress={() => router.push(`/book/${book.id}`)}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* 重命名弹窗（含颜色选择器） */}
      {renameTarget && (
        <View style={[styles.overlay, { backgroundColor: theme.overlayBg }]}>
          <View style={[styles.dialog, { backgroundColor: theme.dialogBg }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>编辑通讯簿</Text>
            <TextInput
              style={[styles.dialogInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="通讯簿名称"
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
                    renameColorIdx === i && styles.colorDotSelected,
                  ]}
                  onPress={() => setRenameColorIdx(i)}
                />
              ))}
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                style={({ pressed }) => [styles.dialogCancel, pressed && { opacity: 0.6 }]}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>取消</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.dialogConfirm, pressed && { opacity: 0.8 }]} onPress={handleRename}>
                <Text style={styles.dialogConfirmText}>确定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <View style={[styles.overlay, { backgroundColor: theme.overlayBg }]}>
          <View style={[styles.dialog, { backgroundColor: theme.dialogBg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="warning" size={18} color="#FF9500" />
              <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}> 删除通讯簿</Text>
            </View>
            <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: Spacing.three, textAlign: 'center' }}>
              将删除「{deleteTarget.name}」及其 {deleteTarget.contactCount} 个联系人{'\n'}
              此操作不可撤销
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: Spacing.one }}>
              请输入通讯簿名称以确认：
            </Text>
            <TextInput
              style={[styles.dialogInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={deleteTarget.name}
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={({ pressed }) => [styles.dialogCancel, pressed && { opacity: 0.6 }]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.dialogConfirm, { backgroundColor: '#FF3B30' }, pressed && { opacity: 0.8 }]}
                onPress={confirmDelete}
              >
                <Text style={styles.dialogConfirmText}>确认删除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 新建弹窗 */}
      {showCreate && (
        <View style={[styles.overlay, { backgroundColor: theme.overlayBg }]}>
          <View style={[styles.dialog, { backgroundColor: theme.dialogBg }]}>
            <Text style={[styles.dialogTitle, { color: theme.textPrimary }]}>新建通讯簿</Text>
            <TextInput
              style={[styles.dialogInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="请输入通讯簿名称"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={({ pressed }) => [styles.dialogCancel, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  setShowCreate(false);
                  setNewName('');
                }}
              >
                <Text style={[styles.dialogCancelText, { color: theme.textSecondary }]}>取消</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.dialogConfirm, pressed && { opacity: 0.8 }]} onPress={handleCreate}>
                <Text style={styles.dialogConfirmText}>创建</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 收藏入口 */}
      {!editMode && (
        <Pressable
          style={({ pressed }) => [styles.favFloat, { backgroundColor: theme.card }, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/favorites' as any)}
        >
          <Icon name="star" size={26} color="#FFD700" />
        </Pressable>
      )}

      {/* FAB */}
      {!editMode && (
        <Pressable style={({ pressed }) => [styles.fab, pressed && { opacity: 0.7 }]} onPress={() => setShowCreate(true)}>
          <Icon name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '700' },
  searchBtn: { padding: Spacing.one },
  editToggle: {
    padding: Spacing.one + Spacing.half,
    borderRadius: 8,
    borderWidth: 1,
  },
  editHint: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  settingsIcon: { fontSize: 26 },
  body: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.four },
  emptyText: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, marginTop: Spacing.one },
  cardWrapper: { marginBottom: Spacing.four },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dragging: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    opacity: 0.95,
  },
  favFloat: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  favFloatIcon: {
    fontSize: 26,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#FFFFFF', fontWeight: '300' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dialog: {
    borderRadius: 16,
    padding: Spacing.four,
    width: '80%',
    maxWidth: 320,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
    marginBottom: Spacing.four,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  dialogCancel: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  dialogCancelText: { fontSize: 16 },
  dialogConfirm: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#208AEF',
    borderRadius: 10,
  },
  dialogConfirmText: { fontSize: 16, color: '#FFFFFF', fontWeight: '600' },
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
});
