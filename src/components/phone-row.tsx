import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Spacing } from '@/constants/theme';

interface Props {
  label: string;
  phone: string;
}

/** 电话号码行 — 标签 + 号码 + 拨号按钮 + 复制按钮 */
export function PhoneRow({ label, phone }: Props) {
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
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.phone}>{phone}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={handleCall}>
          <Text style={styles.btnText}>📞</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleCopy}>
          <Text style={styles.btnText}>📋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 13,
    color: '#808080',
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
    backgroundColor: '#F0F0F3',
  },
  btnText: {
    fontSize: 18,
  },
});

