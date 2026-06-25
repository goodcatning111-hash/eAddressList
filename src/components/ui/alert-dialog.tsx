import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme';
import { Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertCtx {
  showAlert: (config: AlertConfig) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const Ctx = createContext<AlertCtx>({ showAlert: () => {} });

export function useAlert() {
  return useContext(Ctx);
}

export function AlertDialogProvider({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '' });

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const t = {
    bg: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#E0E0E0' : '#111',
    textSecondary: isDark ? '#AAA' : '#808080',
    divider: isDark ? '#333' : '#E0E0E0',
    overlay: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
  };

  const buttons = config.buttons ?? [{ text: '确定' }];

  const handlePress = (btn: AlertButton) => {
    setVisible(false);
    btn.onPress?.();
  };

  return (
    <Ctx.Provider value={{ showAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={[styles.overlay, { backgroundColor: t.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: t.bg }]}>
            <Text style={[styles.title, { color: t.text }]}>{config.title}</Text>
            {config.message ? (
              <Text style={[styles.message, { color: t.textSecondary }]}>{config.message}</Text>
            ) : null}
            <View style={[styles.divider, { backgroundColor: t.divider }]} />
            <View style={styles.actions}>
              {buttons.map((btn, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.btn,
                    i < buttons.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.divider },
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      btn.style === 'destructive' && { color: '#FF3B30' },
                      btn.style === 'cancel' && { color: t.textSecondary, fontWeight: '400' },
                      btn.style !== 'destructive' && btn.style !== 'cancel' && { color: '#208AEF' },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 56,
  },
  dialog: {
    borderRadius: 16,
    width: '78%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: Spacing.four + Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
