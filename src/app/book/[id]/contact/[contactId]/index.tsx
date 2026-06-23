import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { PhoneRow } from '@/components/phone-row';
import { getNameColor, getMorrisColor } from '@/constants/colors';
import { Spacing } from '@/constants/theme';
import * as contactDao from '@/db/dao/contact-dao';
import type { Contact } from '@/db/types';

/** 页面 4：联系人详情 */
export default function ContactDetailScreen() {
  const router = useRouter();
  const { id, contactId } = useLocalSearchParams<{
    id: string;
    contactId: string;
  }>();
  const bookId = Number(id);
  const cId = Number(contactId);

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await contactDao.getById(cId);
      setContact(data);
      if (data) setIsFav(data.isFavorite);
    } catch (err) {
      console.error('加载联系人详情失败:', err);
    } finally {
      setLoading(false);
    }
  }, [cId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>联系人不存在</Text>
      </View>
    );
  }

  const avatarColor = contact.colorIndex >= 0
    ? getMorrisColor(contact.colorIndex)
    : getNameColor(contact.name);
  const lastName =
    contact.name.length > 0 ? contact.name[contact.name.length - 1] : '?';
  const phones = contact.mobilePhones
    ? contact.mobilePhones.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  const handleToggleFav = async () => {
    const next = !isFav;
    setIsFav(next);
    try {
      await contactDao.toggleFavorite(cId, next);
    } catch (err) {
      setIsFav(!next); // 回滚
      console.error('收藏操作失败:', err);
    }
  };

  return (
    <ScrollView style={styles.screen}>
      {/* 头部头像区 */}
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.avatarText, { color: avatarColor.fg }]}>
            {lastName}
          </Text>
        </View>
        <Text style={styles.name}>{contact.name}</Text>
      </View>

      {/* 信息卡片 */}
      <View style={styles.card}>
        {/* 手机号 */}
        {phones.map((phone, index) => (
          <PhoneRow
            key={`phone-${index}`}
            label={phones.length > 1 ? `手机号 ${index + 1}` : '手机号'}
            phone={phone}
          />
        ))}

        {/* 组织路径 */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>路径</Text>
          <Text style={styles.value}>
            {contact.level1Dir} / {contact.level2Dir}
          </Text>
        </View>

        {/* 职务 */}
        {contact.position ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>职务</Text>
            <Text style={styles.value}>{contact.position}</Text>
          </View>
        ) : null}

        {/* 办公电话 */}
        {contact.officePhone ? (
          <PhoneRow label="办公电话" phone={contact.officePhone} />
        ) : null}
      </View>

      {/* 操作按钮：编辑 + 收藏 */}
      <View style={styles.actions}>
        <Pressable
          style={styles.editBtn}
          onPress={() =>
            router.push(`/book/${bookId}/contact/${contact.id}/edit`)
          }
        >
          <Text style={styles.editBtnText}>✎ 编辑联系人</Text>
        </Pressable>
        <Pressable style={styles.favActionBtn} onPress={handleToggleFav}>
          <Text style={styles.favActionText}>
            {isFav ? '⭐' : '☆'} {isFav ? '已收藏' : '收藏'}
          </Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFound: {
    fontSize: 16,
    color: '#808080',
  },
  // 头像区
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  // 信息卡片
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  infoRow: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 13,
    color: '#808080',
    marginBottom: Spacing.half,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  // 底部操作按钮行
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  favActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  favActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  editBtnText: {
    fontSize: 16,
    color: '#208AEF',
    fontWeight: '600',
  },
});
