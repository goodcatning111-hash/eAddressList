import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getNameColor, getMorrisColor } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import type { Contact } from '@/db/types';

interface Props {
  contact: Contact;
  onPress: () => void;
}

/** 联系人行 — 头像 + 姓名 + 职务 + 主手机号 */
export function ContactRow({ contact, onPress }: Props) {
  const avatarColor = contact.colorIndex >= 0
    ? getMorrisColor(contact.colorIndex)
    : getNameColor(contact.name);
  const lastName = contact.name.length > 0 ? contact.name[contact.name.length - 1] : '?';
  const primaryPhone = contact.mobilePhones
    ? contact.mobilePhones.split(',')[0].trim()
    : '';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {/* 头像 */}
      <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColor.fg }]}>
          {lastName}
        </Text>
      </View>

      {/* 信息 */}
      <View style={styles.info}>
        <Text style={styles.name}>{contact.name}</Text>
        {contact.position ? (
          <Text style={styles.position} numberOfLines={1}>
            {contact.position}
          </Text>
        ) : null}
      </View>

      {/* 主手机号 + 箭头 */}
      <View style={styles.phoneArea}>
        {primaryPhone ? (
          <Text style={styles.phone}>{primaryPhone}</Text>
        ) : null}
        <Text style={styles.arrow}>▶</Text>
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
    borderBottomColor: '#E0E0E0',
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
    color: '#808080',
    marginTop: 2,
  },
  phoneArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    fontSize: 14,
    color: '#606060',
    marginRight: Spacing.one,
  },
  arrow: {
    fontSize: 12,
    color: '#C0C0C0',
  },
});
