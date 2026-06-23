import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack>
        {/* 通讯簿门户 */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* 一级目录列表 */}
        <Stack.Screen
          name="book/[id]/index"
          options={{ title: '通讯簿', headerBackTitle: '返回' }}
        />

        {/* 二级目录手风琴 + 联系人 */}
        <Stack.Screen
          name="book/[id]/[level1]/index"
          options={{ title: '', headerBackTitle: '返回' }}
        />

        {/* 联系人详情 */}
        <Stack.Screen
          name="book/[id]/contact/[contactId]/index"
          options={{ title: '联系人详情', headerBackTitle: '返回' }}
        />

        {/* 编辑联系人 (modal) */}
        <Stack.Screen
          name="book/[id]/contact/[contactId]/edit"
          options={{
            title: '编辑联系人',
            headerBackTitle: '取消',
            presentation: 'modal',
          }}
        />

        {/* 新建联系人 (modal) */}
        <Stack.Screen
          name="book/[id]/contact/new"
          options={{
            title: '新建联系人',
            headerBackTitle: '取消',
            presentation: 'modal',
          }}
        />

        {/* 搜索 (modal) */}
        <Stack.Screen
          name="book/[id]/search"
          options={{
            title: '搜索',
            headerBackTitle: '取消',
            presentation: 'modal',
          }}
        />

        {/* 全局搜索 */}
        <Stack.Screen
          name="search"
          options={{ title: '全局搜索', headerBackTitle: '返回' }}
        />

        {/* 收藏联系人 */}
        <Stack.Screen
          name="favorites"
          options={{ title: '⭐ 收藏联系人', headerBackTitle: '返回' }}
        />

        {/* 设置 */}
        <Stack.Screen
          name="settings"
          options={{ title: '设置', headerBackTitle: '返回' }}
        />
      </Stack>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
