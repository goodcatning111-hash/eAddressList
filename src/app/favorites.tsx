import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ContactRow } from '@/components/contact-row';
import { Spacing } from '@/constants/theme';
import * as contactDao from '@/db/dao/contact-dao';
import type { Contact } from '@/db/types';

type FavoriteContact = Contact & { bookName: string };

/** 收藏联系人列表页 */
export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteContact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const list = await contactDao.getFavorites();
      setFavorites(list);
    } catch (err) {
      console.error('加载收藏列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  // 按通讯簿分组
  const grouped = new Map<string, FavoriteContact[]>();
  for (const f of favorites) {
    const key = f.bookName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  return (
    <ScrollView style={styles.screen}>
      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyText}>暂无收藏联系人</Text>
          <Text style={styles.emptyHint}>在联系人详情页点击星标即可收藏</Text>
        </View>
      ) : (
        Array.from(grouped.entries()).map(([bookName, contacts]) => (
          <View key={bookName}>
            <Text style={styles.bookHeader}>{bookName}</Text>
            <View style={styles.card}>
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onPress={() =>
                    router.push(
                      `/book/${contact.addressBookId}/contact/${contact.id}`,
                    )
                  }
                />
              ))}
            </View>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.four },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#808080' },
  emptyHint: { fontSize: 14, color: '#A0A0A0', marginTop: Spacing.one },
  bookHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  card: {
    marginHorizontal: Spacing.four,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
});
