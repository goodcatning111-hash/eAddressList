import { type PropsWithChildren, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed action button width — locked, never flex-collapses. */
const ACTION_BTN_W = 72;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CornerRadii {
  borderTopStartRadius?: number;
  borderTopEndRadius?: number;
  borderBottomStartRadius?: number;
  borderBottomEndRadius?: number;
}

export type SwipeShape = number | CornerRadii;

interface Props extends PropsWithChildren {
  enabled: boolean;
  onEdit: () => void;
  onDelete: () => void;

  /** Card background color — applied to both the clipping container and
   *  the foreground so rounded corners never expose a mismatched hue. */
  cardBackgroundColor: string;

  /** External spacing between list items (Zero-Gap Principle). */
  style?: object;

  /** Dynamic border-radius for the master clipping mask. */
  borderRadius?: SwipeShape;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRadiusStyle(shape: SwipeShape): object {
  if (typeof shape === 'number') {
    return { borderRadius: shape };
  }
  return {
    borderTopStartRadius: shape.borderTopStartRadius,
    borderTopEndRadius: shape.borderTopEndRadius,
    borderBottomStartRadius: shape.borderBottomStartRadius,
    borderBottomEndRadius: shape.borderBottomEndRadius,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UnifiedSwipeableWrapper — canonical swipe-to-reveal container.
 *
 * Architecture:
 * • overshootLeft/Right={false} — bidirectional clamp
 * • Fixed 72px buttons — never collapse
 * • onLayout height sync — foreground → actions row
 * • Light responsive swipe: friction=1, threshold=30, overshootFriction=8
 * • failOffsetY=[-20,20] — diagonal tolerance
 * • overflow:hidden + borderRadius on container for perfect corner clipping
 */
export function UnifiedSwipeableWrapper({
  children,
  enabled,
  onEdit,
  onDelete,
  cardBackgroundColor,
  style,
  borderRadius = 12,
}: Props) {
  const [cardHeight, setCardHeight] = useState(0);

  if (!enabled) return <>{children}</>;

  const radiusStyle = toRadiusStyle(borderRadius);
  const actionsWidth = ACTION_BTN_W * 2;

  const renderRightActions = () => (
    <View style={[styles.actionsRow, { height: cardHeight, width: actionsWidth }]}>
      <TouchableOpacity
        style={[styles.actionBtn, styles.editBtn, { width: ACTION_BTN_W }]}
        onPress={onEdit}
        activeOpacity={0.8}
      >
        <Text style={styles.actionLabel}>编辑</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, styles.deleteBtn, { width: ACTION_BTN_W }]}
        onPress={onDelete}
        activeOpacity={0.8}
      >
        <Text style={styles.actionLabel}>删除</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={style}>
      <Swipeable
        renderRightActions={renderRightActions}
        friction={1}
        rightThreshold={30}
        overshootFriction={8}
        failOffsetY={[-20, 20]}
        overshootLeft={false}
        overshootRight={false}
        containerStyle={[
          radiusStyle,
          {
            overflow: 'hidden',
            backgroundColor: cardBackgroundColor,
          },
        ]}
        childrenContainerStyle={styles.childrenContainer}
      >
        <View
          style={[styles.foregroundCard, { backgroundColor: cardBackgroundColor }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== cardHeight) setCardHeight(h);
          }}
        >
          {children}
        </View>
      </Swipeable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Deprecated alias
// ---------------------------------------------------------------------------

/** @deprecated Use `UnifiedSwipeableWrapper` directly. */
export const SwipeableRow = UnifiedSwipeableWrapper;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  childrenContainer: {
    backgroundColor: 'transparent',
  },
  foregroundCard: {
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: '#208AEF',
  },
  deleteBtn: {
    backgroundColor: '#FF3B30',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
