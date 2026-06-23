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
import { AddressBookCard } from '@/components/address-book-card';
import { UnifiedSwipeableWrapper } from '@/components/ui/swipeable-row';
import { getMorrisColor, MorrisColors } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import * as addressBookDao from '@/db/dao/address-book-dao';
import * as contactDao from '@/db/dao/contact-dao';
import { getBookColor } from '@/db/dao/address-book-dao';
import type { AddressBook } from '@/db/types';

/** 页面 1：通讯簿门户 — 展示所有通讯簿卡片，支持编辑模式 */
export default function PortalScreen() {
  const router = useRouter();
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>我的通讯录</Text>
          {!editMode && (
            <Pressable
              style={styles.searchBtn}
              onPress={() => router.push('/search' as any)}
            >
              <Text style={{ fontSize: 20 }}>🔍</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={[styles.editToggle, editMode && styles.editToggleActive]}
            onPress={() => setEditMode(!editMode)}
          >
            <Text style={{ fontSize: 16 }}>
              {editMode ? '🔓 完成' : '🔒 编辑'}
            </Text>
          </Pressable>
          {!editMode && (
            <Pressable onPress={() => router.push('/settings')}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          )}
        </View>
      </View>
      {editMode && (
        <View style={styles.editHint}>
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
        >
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>暂无通讯簿</Text>
            <Text style={styles.emptyHint}>点击下方 + 按钮创建</Text>
          </View>
        </ScrollView>
      ) : editMode ? (
        <View style={styles.body}>
          <DraggableFlatList
            data={books}
            keyExtractor={(item) => String(item.id)}
            onDragEnd={async ({ data }) => {
              await addressBookDao.reorderAll(data.map((b) => b.id));
              setBooks(data);
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<AddressBook>) => {
                const colorIdx = item.colorIndex >= 0 ? item.colorIndex : item.id;
                const cardBg = getMorrisColor(colorIdx).bg;
                return (
                <UnifiedSwipeableWrapper
                  enabled
                  style={[styles.cardWrapper, isActive && styles.dragging]}
                  cardBackgroundColor={cardBg}
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
                    onLongPress={() => drag()}
                  />
                </UnifiedSwipeableWrapper>
                );
            }}
          />
        </View>
      ) : (
        <ScrollView style={styles.body}>
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
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>编辑通讯簿</Text>
            <TextInput
              style={styles.dialogInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="通讯簿名称"
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
                    renameColorIdx === i && styles.colorDotSelected,
                  ]}
                  onPress={() => setRenameColorIdx(i)}
                />
              ))}
            </View>
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.dialogConfirm} onPress={handleRename}>
                <Text style={styles.dialogConfirmText}>确定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>⚠ 删除通讯簿</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: Spacing.three, textAlign: 'center' }}>
              将删除「{deleteTarget.name}」及其 {deleteTarget.contactCount} 个联系人{'\n'}
              此操作不可撤销
            </Text>
            <Text style={{ fontSize: 13, color: '#808080', marginBottom: Spacing.one }}>
              请输入通讯簿名称以确认：
            </Text>
            <TextInput
              style={styles.dialogInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={deleteTarget.name}
              autoFocus
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogConfirm, { backgroundColor: '#FF3B30' }]}
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
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>新建通讯簿</Text>
            <TextInput
              style={styles.dialogInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="请输入通讯簿名称"
              autoFocus
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => {
                  setShowCreate(false);
                  setNewName('');
                }}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.dialogConfirm} onPress={handleCreate}>
                <Text style={styles.dialogConfirmText}>创建</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 收藏入口 */}
      {!editMode && (
        <Pressable
          style={styles.favFloat}
          onPress={() => router.push('/favorites' as any)}
        >
          <Text style={styles.favFloatIcon}>⭐</Text>
        </Pressable>
      )}

      {/* FAB */}
      {!editMode && (
        <Pressable style={styles.fab} onPress={() => setShowCreate(true)}>
          <Text style={styles.fabText}>+</Text>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '700' },
  searchBtn: { padding: Spacing.one },
  editToggle: {
    padding: Spacing.one + Spacing.half,
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
  },
  editToggleActive: { backgroundColor: '#FFE5CC' },
  editHint: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#FFF8E1',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFE0B2',
    alignItems: 'center',
  },
  settingsIcon: { fontSize: 26 },
  body: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.four },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#808080' },
  emptyHint: { fontSize: 14, color: '#A0A0A0', marginTop: Spacing.one },
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  deleteBtn: { borderColor: '#FFD0D0' },
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
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
    borderColor: '#D0D0D5',
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
  dialogCancelText: { fontSize: 16, color: '#808080' },
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
