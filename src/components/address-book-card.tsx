import { Pressable, StyleSheet, Text } from 'react-native';
import { getMorrisColorForTheme } from '@/constants/colors';
import { useTheme } from '@/contexts/theme';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';
import type { AddressBook } from '@/db/types';

interface Props { book: AddressBook; index: number; onPress: () => void; onLongPress?: () => void; }

export function AddressBookCard({ book, index, onPress, onLongPress }: Props) {
  const { isDark } = useTheme();
  const color = getMorrisColorForTheme(book.colorIndex >= 0 ? book.colorIndex : index, isDark);
  const haptic = useHapticScale();
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: color.bg }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      onLongPress={onLongPress ? () => { haptic(); onLongPress(); } : undefined}
      delayLongPress={280}
    >
      <Text style={[styles.name, { color: color.fg }]}>{book.name}</Text>
      <Text style={[styles.count, { color: color.fg }]}>{book.contactCount} 人</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.five, minHeight: 120, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  name: { fontSize: 22, fontWeight: '700' },
  count: { fontSize: 18, fontWeight: '500', opacity: 0.7 },
});
