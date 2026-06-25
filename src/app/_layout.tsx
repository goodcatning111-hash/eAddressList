import { useEffect } from 'react';
import { Platform, Pressable, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as ExpoThemeProvider, DefaultTheme, DarkTheme } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemeProvider, useTheme } from '@/contexts/theme';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AlertDialogProvider } from '@/components/ui/alert-dialog';

const NavLightTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#F5F5F7' } };
const NavDarkTheme  = { ...DarkTheme,  colors: { ...DarkTheme.colors,  background: '#121212' } };

function InnerLayout() {
  const { isDark } = useTheme();
  return (
    <AlertDialogProvider>
      <ExpoThemeProvider value={isDark ? NavDarkTheme : NavLightTheme}>
        <Stack screenOptions={({ navigation }) => ({ animation: 'slide_from_right', contentStyle: { backgroundColor: isDark ? '#121212' : '#F5F5F7' }, headerLeft: ({ canGoBack, tintColor }) => canGoBack ? <Pressable onPress={() => navigation.goBack()} style={{ marginLeft: Platform.OS === 'ios' ? -8 : 0 }}><MaterialIcons name="chevron-left" size={28} color={tintColor} /></Pressable> : undefined })}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="book/[id]/index" options={{ title: '通讯簿', headerBackTitle: '返回' }} />
          <Stack.Screen name="book/[id]/[level1]/index" options={{ title: '', headerBackTitle: '返回' }} />
          <Stack.Screen name="book/[id]/contact/[contactId]/index" options={{ title: '联系人详情', headerBackTitle: '返回' }} />
          <Stack.Screen name="book/[id]/contact/[contactId]/edit" options={{ title: '编辑联系人', headerBackTitle: '取消', presentation: 'modal' }} />
          <Stack.Screen name="book/[id]/contact/new" options={{ title: '新建联系人', headerBackTitle: '取消', presentation: 'modal' }} />
          <Stack.Screen name="book/[id]/search" options={{ title: '搜索', headerBackTitle: '取消', presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ title: '全局搜索', headerBackTitle: '返回' }} />
          <Stack.Screen name="favorites" options={{ title: '收藏联系人', headerBackTitle: '返回' }} />
          <Stack.Screen name="settings" options={{ title: '设置', headerBackTitle: '返回' }} />
        </Stack>
      </ExpoThemeProvider>
    </AlertDialogProvider>
  );
}

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const bg = isDark ? '#121212' : '#F5F5F7';
  useEffect(() => { SystemUI.setBackgroundColorAsync(bg); }, [bg]);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <ThemeProvider>
        <InnerLayout />
      </ThemeProvider>
      <AnimatedSplashOverlay />
    </GestureHandlerRootView>
  );
}
