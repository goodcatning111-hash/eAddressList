import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';

interface Props {
  name: string;
  count: number;
  bgColor: string;
  fgColor: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/** 一级/二级目录卡片 */
export function DirectoryCard({
  name,
  count,
  bgColor,
  fgColor,
  onPress,
  onLongPress,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bgColor },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Text style={[styles.name, { color: fgColor }]}>{name}</Text>
      <Text style={[styles.count, { color: fgColor }]}>
        {count} 人
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  count: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
});
