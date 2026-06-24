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
  const arrowColor = isDark ? '#555' : '#C0C0C0';
  const avatarColor = contact.colorIndex >= 0
    ? getMorrisColor(contact.colorIndex)
    : getNameColor(contact.name);
  const lastName = contact.name.length > 0 ? contact.name[contact.name.length - 1] : '?';
  const primaryPhone = contact.mobilePhones
    ? contact.mobilePhones.split(',')[0].trim()
    : '';

  return (
    <Pressable style={({ pressed }) => [styles.row, { borderBottomColor: isDark ? '#333' : '#E0E0E0' }, backgroundColor ? { backgroundColor } : null, pressed && { opacity: 0.6 }]} onPress={onPress}>
      {/* 头像 */}
      <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColor.fg }]}>
          {lastName}
        </Text>
      </View>

      {/* 信息 */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: isDark ? '#E0E0E0' : '#111' }]}>{contact.name}</Text>
        {contact.position ? (
          <Text style={[styles.position, { color: isDark ? '#AAA' : '#808080' }]} numberOfLines={1}>
            {contact.position}
          </Text>
        ) : null}
      </View>

      {/* 主手机号 + 箭头 */}
      <View style={styles.phoneArea}>
        {primaryPhone ? (
          <Text style={[styles.phone, { color: isDark ? '#CCC' : '#606060' }]}>{primaryPhone}</Text>
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
