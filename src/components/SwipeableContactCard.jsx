
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

/**
 * 统一的滑动操作卡片包装器 (React Native / Expo 专用版)
 * 完美解决：
 * 1. 左右滑动越界/飞出 (overshootLeft/Right = false)
 * 2. 按钮宽度坍塌变小 (固定 72px 宽度，不使用弹性伸缩)
 * 3. 动态高度无法对齐 (使用 onLayout 实时同步高度，完美支持手风琴展开)
 * 4. 边缘缝隙与露角问题 (利用父级蒙版裁剪，前景卡片去圆角化)
 */
export default function SwipeableContactCard({
  children,
  onEdit,
  onDelete,
  cardBackgroundColor = '#FBE9E7', // 默认莫兰迪卡片背景色
  borderRadius = 12,
  buttonWidth = 72, // 每个按钮的固定宽度
}) {
  // 动态测量并记录卡片内容的高度
  const [cardHeight, setCardHeight] = useState(0);
  const totalActionsWidth = buttonWidth * 2; // 编辑 + 删除 = 144px

  // 渲染右侧操作按钮区
  const renderRightActions = () => {
    return (
      <View style={[styles.actionsRow, { height: cardHeight, width: totalActionsWidth }]}>
        {/* 编辑按钮 - 固定宽度，绝不坍塌 */}
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton, { width: buttonWidth }]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>编辑</Text>
        </TouchableOpacity>

        {/* 删除按钮 - 固定宽度，绝不坍塌 */}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, { width: buttonWidth }]}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>删除</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.spacingContainer}>
      <Swipeable
        renderRightActions={renderRightActions}
        friction={1.5}
        rightThreshold={40}
        // 【防飞限位核心】：禁止向左或向右过量拉伸，卡片滑到按钮总宽时会物理锁死
        overshootLeft={false}
        overshootRight={false}
        // 外部裁剪层：强行把卡片和背后所有按钮裁剪出统一的圆角效果
        containerStyle={[
          styles.swipeableContainer,
          { borderRadius: borderRadius, backgroundColor: cardBackgroundColor }
        ]}
        childrenContainerStyle={styles.childrenContainer}
      >
        {/* 前景卡片：
          1. 绝不设置任何 borderRadius (设为 0)！依靠外层的 containerStyle 进行圆角裁剪。
             这就彻底消除了滑动时右侧圆角漏出的“白色缝隙”，再也不需要任何多余的“圆角填补条”！
          2. 使用 onLayout 动态监听卡片高度，无论是内容变多还是手风琴展开，高度都会无缝传给背景按钮。
        */}
        <View
          style={[styles.foregroundCard, { backgroundColor: cardBackgroundColor }]}
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout;
            if (height && height !== cardHeight) {
              setCardHeight(height); // 实时更新并同步高度
            }
          }}
        >
          {children}
        </View>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 负责列表项之间的外边距，将布局间距彻底隔离在侧滑组件之外
  spacingContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  // 父级蒙版裁剪层：让整个侧滑区域在视觉上呈现完美的圆角包裹
  swipeableContainer: {
    overflow: 'hidden',
    // 提升渲染性能，防止安卓圆角锯齿
    elevation: 0,
  },
  childrenContainer: {
    backgroundColor: 'transparent',
  },
  // 前景内容卡片
  foregroundCard: {
    width: '100%',
    // 注意：不要在这里加任何 borderBottomRightRadius 或 borderTopRightRadius！
  },
  // 背景操作按钮容器
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2196F3', // 经典编辑蓝
  },
  deleteButton: {
    backgroundColor: '#F44336', // 警示删除红
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

