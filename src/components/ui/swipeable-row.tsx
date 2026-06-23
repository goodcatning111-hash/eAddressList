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
 * UnifiedSwipeableWrapper — canonical swipe-to-reveal container for every
 * swipeable list item in the app.
 *
 * Architecture (adapted from src/components/SwipeableContactCard.jsx):
 *
 * • `overshootLeft/Right={false}` — bidirectional clamp; card physically
 *   can't fly past the action area.
 * • Fixed 72 px buttons — never collapse.
 * • `onLayout` height sync — foreground height is measured live and written
 *   to the background action row so heights are always locked (handles
 *   accordion expand/collapse seamlessly).
 * • Foreground card `borderRadius: 0` — relies entirely on the Swipeable
 *   `containerStyle`'s `overflow:'hidden'` + `borderRadius` for clipping.
 *   **No corner-fill strip needed.**
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
  if (!enabled) return <>{children}</>;

  const [cardHeight, setCardHeight] = useState(0);
  const radiusStyle = toRadiusStyle(borderRadius);
  const actionsWidth = ACTION_BTN_W * 2; // 144

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
        friction={1.5}
        rightThreshold={40}
        // Bidirectional clamp → card cannot fly past the action area.
        overshootLeft={false}
        overshootRight={false}
        // Master clipping mask: all rounding lives here.
        containerStyle={[
          radiusStyle,
          {
            overflow: 'hidden',
            backgroundColor: cardBackgroundColor,
          },
        ]}
        childrenContainerStyle={styles.childrenContainer}
      >
        {/* Foreground card — deliberately borderRadius: 0.
            The containerStyle above owns ALL clipping; this guarantees
            zero visible gap or corner bleed when the card slides. */}
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
    // Intentional: NO borderRadius here!
    // All clipping is done by Swipeable's containerStyle.
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
