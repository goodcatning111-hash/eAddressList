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

/** 新建联系人页面 */
export default function NewContactScreen() {
  const router = useRouter();
  const { id, l1, l2 } = useLocalSearchParams<{ id: string; l1?: string; l2?: string }>();
  const bookId = Number(id);

  const [level1Options, setLevel1Options] = useState<string[]>([]);
  const [level2Options, setLevel2Options] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const l1Dirs = await contactDao.getAllLevel1Dirs(bookId);
      setLevel1Options(l1Dirs);
      // 如果传了 l1，预加载其 l2 选项
      if (l1) {
        const l2Dirs = await contactDao.getLevel2Dirs(bookId, l1);
        setLevel2Options(l2Dirs);
      }
    } catch (err) {
      console.error('加载目录数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId, l1]);

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
      await contactDao.create(bookId, data);
      Alert.alert('成功', '联系人已创建', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('创建联系人失败:', err);
      Alert.alert('错误', '创建失败，请重试');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <ContactForm
      level1Options={level1Options}
      level2Options={level2Options}
      onLevel1Change={handleLevel1Change}
      onSave={handleSave}
      initialLevel1={l1 ? decodeURIComponent(l1) : undefined}
      initialLevel2={l2 ? decodeURIComponent(l2) : undefined}
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
