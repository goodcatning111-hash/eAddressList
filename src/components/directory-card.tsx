import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/contexts/theme';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';

interface Props { name: string; count: number; bgColor: string; fgColor: string; onPress: () => void; onLongPress?: () => void; }

export function DirectoryCard({ name, count, bgColor, fgColor, onPress, onLongPress }: Props) {
  const { isDark } = useTheme();
  const haptic = useHapticScale();
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: bgColor }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      onLongPress={onLongPress ? () => { haptic(); onLongPress(); } : undefined}
      delayLongPress={280}
    >
      <Text style={[styles.name, { color: fgColor }]}>{name}</Text>
      <Text style={[styles.count, { color: fgColor }]}>{count} 人</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: Spacing.four, minHeight: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '600', flex: 1 },
  count: { fontSize: 16, fontWeight: '500', opacity: 0.7 },
});
