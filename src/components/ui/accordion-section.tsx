import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { useHapticScale } from '@/hooks/use-haptic-scale';
import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';

interface Props extends PropsWithChildren {
  title: string; count: number; bgColor: string; fgColor: string; footer?: ReactNode;
  expanded?: boolean; onToggle?: () => void; headerOnPress?: () => void; headerOnLongPress?: () => void;
  containerStyle?: object;
}

export function AccordionSection({ title, count, bgColor, fgColor, children, footer, expanded: externalExpanded, onToggle, headerOnPress, headerOnLongPress, containerStyle }: Props) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const haptic = useHapticScale();
  const toggle = () => { if (onToggle) onToggle(); else setInternalExpanded(!internalExpanded); };
  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle]}>
      <Pressable
        style={styles.header}
        onPress={() => { if (headerOnPress) headerOnPress(); else toggle(); }}
        onLongPress={headerOnLongPress ? () => { haptic(); headerOnLongPress(); } : undefined}
        delayLongPress={280}
      >
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: fgColor }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.count, { color: fgColor }]}>({count})</Text>
          </View>
          <Icon name={expanded ? 'expand-less' : 'expand-more'} size={18} color={fgColor} />
        </View>
      </Pressable>
      {expanded && <View style={styles.body}>{children}{footer}</View>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { borderRadius: 12, marginBottom: Spacing.three, overflow: 'hidden' },
  header: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', flex: 1, marginRight: Spacing.two, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  count: { fontSize: 14, opacity: 0.7, marginLeft: Spacing.one },
  chevron: { fontSize: 14, width: 20, textAlign: 'center' },
  body: { paddingBottom: Spacing.one },
});
