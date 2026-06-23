import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ContactForm } from '@/components/contact-form';
import * as contactDao from '@/db/dao/contact-dao';
import type { Contact } from '@/db/types';

/** 编辑联系人页面 */
export default function EditContactScreen() {
  const router = useRouter();
  const { id, contactId } = useLocalSearchParams<{
    id: string;
    contactId: string;
  }>();
  const bookId = Number(id);
  const cId = Number(contactId);

  const [contact, setContact] = useState<Contact | null>(null);
  const [level1Options, setLevel1Options] = useState<string[]>([]);
  const [level2Options, setLevel2Options] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [contactData, l1Dirs] = await Promise.all([
        contactDao.getById(cId),
        contactDao.getAllLevel1Dirs(bookId),
      ]);
      setContact(contactData);
      setLevel1Options(l1Dirs);
      if (contactData) {
        const l2Dirs = await contactDao.getLevel2Dirs(
          bookId,
          contactData.level1Dir,
        );
        setLevel2Options(l2Dirs);
      }
    } catch (err) {
      console.error('加载联系人数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId, cId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleLevel1Change = async (level1: string) => {
    try {
      const dirs = await contactDao.getLevel2Dirs(bookId, level1);
      setLevel2Options(dirs);
    } catch (err) {
      console.error('加载二级目录失败:', err);
    }
  };

  const handleSave = async (data: any) => {
    try {
      await contactDao.update(cId, data);
      Alert.alert('成功', '联系人已更新', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('更新联系人失败:', err);
      Alert.alert('错误', '更新失败，请重试');
    }
  };

  const handleDelete = async () => {
    try {
      await contactDao.remove(cId);
      Alert.alert('成功', '联系人已删除', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('删除联系人失败:', err);
      Alert.alert('错误', '删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <ContactForm
      contact={contact}
      level1Options={level1Options}
      level2Options={level2Options}
      onLevel1Change={handleLevel1Change}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
