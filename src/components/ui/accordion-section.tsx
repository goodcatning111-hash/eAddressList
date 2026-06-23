import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';

interface Props extends PropsWithChildren {
  title: string;
  count: number;
  bgColor: string;
  fgColor: string;
  footer?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  headerOnPress?: () => void;
  headerOnLongPress?: () => void;
  /** Override the outer container style (e.g. suppress marginBottom in swipe mode). */
  containerStyle?: object;
}

/** 可折叠手风琴组件 — 用于二级目录展开/折叠联系人列表 */
export function AccordionSection({
  title,
  count,
  bgColor,
  fgColor,
  children,
  footer,
  expanded: externalExpanded,
  onToggle,
  headerOnPress,
  headerOnLongPress,
  containerStyle,
}: Props) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;

  const toggle = () => {
    if (onToggle) onToggle();
    else setInternalExpanded(!internalExpanded);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle]}>
      <Pressable
        style={styles.header}
        onPress={() => {
          if (headerOnPress) headerOnPress();
          else toggle();
        }}
        onLongPress={headerOnLongPress}
        delayLongPress={400}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[styles.title, { color: fgColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <Text style={[styles.count, { color: fgColor }]}>
            ({count})
          </Text>
        </View>
        <Text style={[styles.chevron, { color: fgColor }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {children}
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    marginRight: Spacing.two,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  count: {
    fontSize: 14,
    opacity: 0.7,
    marginLeft: Spacing.one,
  },
  chevron: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  body: {
    paddingBottom: Spacing.one,
  },
});
