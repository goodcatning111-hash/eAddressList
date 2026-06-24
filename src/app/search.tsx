import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/icon';
import { ContactRow } from '@/components/contact-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
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
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');

  const theme = {
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    textSecondary: isDark ? '#AAA' : '#808080',
    textPrimary: isDark ? '#E0E0E0' : '#000',
    bookHeader: isDark ? '#CCCCCC' : '#808080',
    border: isDark ? '#444' : '#E0E0E5',
    inputBg: isDark ? '#2A2A2A' : '#FFFFFF',
  };
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
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
        <Icon name="search" size={22} style={{ marginRight: Spacing.two }} />
        <TextInput
          style={[styles.input, { color: theme.textPrimary }]}
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={handleChangeText}
          placeholder="搜索所有通讯簿中的联系人..."
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery('');
              setGroups([]);
            }}
          >
            <Icon name="close" size={22} color={theme.textSecondary} />
          </Pressable>
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
                  <Text style={[styles.bookHeader, { color: theme.bookHeader }]}>{(item as any)._groupName}</Text>
                )}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
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
                <Icon name="search" size={48} style={{ marginBottom: Spacing.three }} />
                <Text style={{ fontSize: 16, color: theme.textSecondary }}>
                  未找到匹配联系人
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="touch-app" size={48} secondary />
                <Text style={{ fontSize: 16, color: theme.textSecondary }}>
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
    margin: Spacing.four,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two + Spacing.one },
  bookHeader: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  card: {
    marginHorizontal: Spacing.four,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  emptyState: { alignItems: 'center', paddingTop: 80 },
});
