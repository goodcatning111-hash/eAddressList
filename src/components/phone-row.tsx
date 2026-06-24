import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';

interface Props {
  label: string;
  phone: string;
}

/** 电话号码行 — 标签 + 号码 + 拨号按钮 + 复制按钮 */
export function PhoneRow({ label, phone }: Props) {
  const { isDark } = useTheme();
  const handleCall = async () => {
    const url = `tel:${phone.replace(/\s/g, '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('提示', '当前设备不支持拨号');
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(phone);
    Alert.alert('已复制', `号码 ${phone} 已复制到剪贴板`);
  };

  return (
    <View style={[styles.row, { borderBottomColor: isDark ? '#333' : '#E0E0E0' }]}>
      <Text style={[styles.label, { color: isDark ? '#AAA' : '#808080' }]}>{label}</Text>
      <Text style={[styles.phone, { color: isDark ? '#E0E0E0' : '#111' }]}>{phone}</Text>
      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: isDark ? '#333' : '#F0F0F3' }, pressed && { opacity: 0.6 }]} onPress={handleCall}>
          <Icon name="call" size={22} color="#208AEF" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: isDark ? '#333' : '#F0F0F3' }, pressed && { opacity: 0.6 }]} onPress={handleCopy}>
          <Icon name="content-copy" size={22} color={isDark ? '#CCC' : '#606060'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 13,
    marginBottom: Spacing.half,
  },
  phone: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  btn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 18,
  },
});

