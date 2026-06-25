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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '@/components/icon';
import { ContactRow } from '@/components/contact-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import * as contactDao from '@/db/dao/contact-dao';
import type { Contact } from '@/db/types';

/** 搜索页面 — 在当前通讯簿内按姓名搜索联系人 */
export default function SearchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const { isDark } = useTheme();

  const theme = {
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#2A2A2A' : '#FFFFFF',
    textSecondary: isDark ? '#AAA' : '#808080',
    textPrimary: isDark ? '#E0E0E0' : '#000',
    border: isDark ? '#444' : '#E0E0E5',
    inputBg: isDark ? '#1E1E1E' : '#FFFFFF',
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 去抖动搜索：300ms 后触发
  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length === 0) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await contactDao.getByBookId(bookId, q.trim());
        setResults(data);
      } catch (err) {
        console.error('搜索失败:', err);
      } finally {
        setSearching(false);
      }
    },
    [bookId],
  );

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

  return (
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      {/* 搜索栏 */}
      <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
        <Icon name="search" size={22} style={{ marginRight: Spacing.two }} />
        <TextInput
          style={[styles.input, { color: theme.textPrimary }]}
          value={query}
          onChangeText={handleChangeText}
          placeholder="搜索联系人姓名..."
          placeholderTextColor={theme.textSecondary}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Icon name="close" size={22} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* 结果列表 */}
      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              onPress={() =>
                router.push(`/book/${bookId}/contact/${item.id}`)
              }
            />
          )}
          ListEmptyComponent={
            query.trim().length > 0 ? (
              <View style={styles.emptyState}>
                <Icon name="search" size={48} style={{ marginBottom: Spacing.three }} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>未找到匹配联系人</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="touch-app" size={48} secondary />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>输入姓名开始搜索</Text>
              </View>
            )
          }
          contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.four,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two + Spacing.one,
  },
  clearBtn: {
    fontSize: 18,
    padding: Spacing.one,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.three,
  },
  emptyText: {
    fontSize: 16,
  },
});
