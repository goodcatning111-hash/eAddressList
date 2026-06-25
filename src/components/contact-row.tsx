import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { getNameColor, getMorrisColor } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme';
import type { Contact } from '@/db/types';

interface Props {
  contact: Contact;
  onPress: () => void;
  backgroundColor?: string;
}

/** 联系人行 — 头像 + 姓名 + 职务 + 主手机号 */
export function ContactRow({ contact, onPress, backgroundColor }: Props) {
  const { isDark } = useTheme();

  // Bright card bg → dark text; dark bg / no bg → light text (standard dark mode)
  const isLightBg = (() => {
    if (!backgroundColor) return false;
    const r = parseInt(backgroundColor.slice(1, 3), 16);
    const g = parseInt(backgroundColor.slice(3, 5), 16);
    const b = parseInt(backgroundColor.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 145;
  })();

  const nameColor      = (isDark && !isLightBg) ? '#E0E0E0' : '#111';
  const positionColor  = (isDark && !isLightBg) ? '#AAA' : '#606060';
  const phoneColor     = (isDark && !isLightBg) ? '#CCC' : '#505050';
  const borderColor    = (isDark && !isLightBg) ? '#333' : '#D0D0D5';
  const arrowColor     = (isDark && !isLightBg) ? '#555' : '#C0C0C0';

  const avatarColor = contact.colorIndex >= 0
    ? getMorrisColor(contact.colorIndex)
    : getNameColor(contact.name);
  const lastName = contact.name.length > 0 ? contact.name[contact.name.length - 1] : '?';
  const primaryPhone = contact.mobilePhones
    ? contact.mobilePhones.split(',')[0].trim()
    : '';

  return (
    <Pressable style={({ pressed }) => [styles.row, { borderBottomColor: borderColor }, backgroundColor ? { backgroundColor } : null, pressed && { opacity: 0.6 }]} onPress={onPress}>
      {/* 头像 */}
      <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColor.fg }]}>
          {lastName}
        </Text>
      </View>

      {/* 信息 */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: nameColor }]}>{contact.name}</Text>
        {contact.position ? (
          <Text style={[styles.position, { color: positionColor }]} numberOfLines={1}>
            {contact.position}
          </Text>
        ) : null}
      </View>

      {/* 主手机号 + 箭头 */}
      <View style={styles.phoneArea}>
        {primaryPhone ? (
          <Text style={[styles.phone, { color: phoneColor }]}>{primaryPhone}</Text>
        ) : null}
        <Icon name="chevron-right" size={22} color={arrowColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginRight: Spacing.two,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  position: {
    fontSize: 13,
    marginTop: 2,
  },
  phoneArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    fontSize: 14,
    marginRight: Spacing.one,
  },
  arrow: {
    fontSize: 12,
  },
});
