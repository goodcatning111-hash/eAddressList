import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMorrisColor } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import type { AddressBook } from '@/db/types';

interface Props {
  book: AddressBook;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
}

/** 通讯簿大卡片 — 用于门户页展示 */
export function AddressBookCard({ book, index, onPress, onLongPress }: Props) {
  // 优先用通讯簿自定义颜色，否则用传入的 index
  const colorIdx = book.colorIndex >= 0 ? book.colorIndex : index;
  const color = getMorrisColor(colorIdx);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.bg },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.content}>
        <Text style={[styles.name, { color: color.fg }]}>{book.name}</Text>
        <Text style={[styles.count, { color: color.fg }]}>
          {book.contactCount} 人
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.five,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  count: {
    fontSize: 18,
    fontWeight: '500',
    opacity: 0.7,
  },
});
