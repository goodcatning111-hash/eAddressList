import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ContactRow } from '@/components/contact-row';
import { Spacing } from '@/constants/theme';
import * as contactDao from '@/db/dao/contact-dao';
import type { Contact } from '@/db/types';

type SearchResult = Contact & { bookName: string };

/** 分组后的搜索结果 */
interface ResultGroup {
  bookName: string;
  bookId: number;
  contacts: SearchResult[];
}

/** 全局搜索 — 跨所有通讯簿搜索，按通讯簿分组展示 */
export default function GlobalSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setGroups([]);
      return;
    }
    setSearching(true);
    try {
      const data = await contactDao.searchAllWithBookName(q.trim());
      // 按通讯簿分组
      const map = new Map<string, ResultGroup>();
      for (const item of data) {
        const key = item.bookName;
        if (!map.has(key)) {
          map.set(key, { bookName: key, bookId: item.addressBookId, contacts: [] });
        }
        map.get(key)!.contacts.push(item);
      }
      setGroups(Array.from(map.values()));
    } catch (err) {
      console.error('全局搜索失败:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text), 300);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 展平所有联系人用于 FlatList
  const flatItems = groups.flatMap((g) =>
    g.contacts.map((c) => ({ ...c, _groupName: g.bookName })),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Text style={{ fontSize: 16, marginRight: Spacing.two }}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder="搜索所有通讯簿中的联系人..."
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Text
            style={{ fontSize: 18, color: '#C0C0C0', padding: Spacing.one }}
            onPress={() => {
              setQuery('');
              setGroups([]);
            }}
          >
            ✕
          </Text>
        )}
      </View>

      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) => `${item._groupName}-${item.id}`}
          renderItem={({ item, index }) => {
            // 在每组第一行前显示通讯簿名
            const isFirstInGroup =
              index === 0 ||
              (flatItems[index - 1] as any)._groupName !== item._groupName;
            return (
              <View>
                {isFirstInGroup && (
                  <Text style={styles.bookHeader}>{(item as any)._groupName}</Text>
                )}
                <View style={styles.card}>
                  <ContactRow
                    contact={item}
                    onPress={() =>
                      router.push(
                        `/book/${item.addressBookId}/contact/${item.id}`,
                      )
                    }
                  />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            query.trim().length > 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: Spacing.three }}>🔍</Text>
                <Text style={{ fontSize: 16, color: '#808080' }}>
                  未找到匹配联系人
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: Spacing.three }}>👆</Text>
                <Text style={{ fontSize: 16, color: '#808080' }}>
                  输入姓名或职务开始搜索
                </Text>
              </View>
            )
          }
          contentContainerStyle={
            flatItems.length === 0
              ? { flex: 1, justifyContent: 'center' }
              : { paddingBottom: 40 }
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: Spacing.four,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two + Spacing.one },
  bookHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#808080',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  card: {
    marginHorizontal: Spacing.four,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  emptyState: { alignItems: 'center', paddingTop: 80 },
});
