import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx { mode: ThemeMode; setMode: (m: ThemeMode) => void; isDark: boolean; }

const Ctx = createContext<ThemeCtx>({ mode: 'system', setMode: () => {}, isDark: false });

const KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v) setModeState(v as ThemeMode); setLoaded(true); });
  }, []);

  const setMode = useCallback((m: ThemeMode) => { setModeState(m); AsyncStorage.setItem(KEY, m); }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  if (!loaded) return null;
  return <Ctx.Provider value={{ mode, setMode, isDark }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx { return useContext(Ctx); }

/** Unified theme colors — consistent dark/light palette for all pages. */
export function useAppTheme() {
  const { isDark } = useTheme();
  return {
    isDark,
    screen: isDark ? '#121212' : '#F5F5F7',
    card: isDark ? '#2A2A2A' : '#FFFFFF',
    border: isDark ? '#3A3A3A' : '#E0E0E0',
    text: isDark ? '#E0E0E0' : '#111',
    textSecondary: isDark ? '#AAA' : '#808080',
    textTertiary: isDark ? '#888' : '#A0A0A0',
    toggle: isDark ? '#383838' : '#F0F0F3',
    toggleActive: isDark ? '#383838' : '#E8E8EC',
    inputBg: isDark ? '#2A2A2A' : '#FFFFFF',
    inputBorder: isDark ? '#444' : '#D0D0D5',
    dialogBg: isDark ? '#2A2A2A' : '#FFFFFF',
    overlayBg: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
    editHintBg: isDark ? '#2A2A2A' : '#FFF8E1',
    editHintBorder: isDark ? '#444' : '#FFE0B2',
    toolBtnBg: isDark ? '#333' : '#FFFFFF',
    toolBtnBorder: isDark ? '#444' : '#E0E0E5',
    headerBg: isDark ? '#2A2A2A' : '#FFFFFF',
    slotFilledBg: isDark ? '#152535' : '#F0F7FF',
    menuBtnBg: isDark ? '#333' : '#F0F0F3',
    warnBg: isDark ? '#332A00' : '#FFF3CD',
    warnText: isDark ? '#FFD700' : '#856404',
    arrow: isDark ? '#555' : '#C0C0C0',
    contactPhone: isDark ? '#CCC' : '#606060',
    contactPosition: isDark ? '#AAA' : '#606060',
  } as const;
}
