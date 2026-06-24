import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { MorrisColors } from '@/constants/colors';
import { useTheme } from '@/contexts/theme';
import type { ContactFormData, Contact } from '@/db/types';

interface Props {
  /** 编辑模式：传入已有联系人数据 */
  contact?: Contact;
  /** 预填一级目录（新建模式） */
  initialLevel1?: string;
  /** 预填二级目录（新建模式） */
  initialLevel2?: string;
  /** 可选的一级目录列表（下拉用） */
  level1Options: string[];
  /** 可选的二级目录列表（下拉用），会随一级目录变化 */
  level2Options: string[];
  /** 一级目录变更时重新加载二级目录 */
  onLevel1Change: (level1: string) => void;
  /** 保存回调 */
  onSave: (data: ContactFormData) => void;
  /** 删除回调（仅编辑模式） */
  onDelete?: () => void;
}

/**
 * 联系人表单 — 新建/编辑共用。
 * 支持动态增删手机号输入框。
 */
export function ContactForm({
  contact,
  initialLevel1,
  initialLevel2,
  level1Options,
  level2Options,
  onLevel1Change,
  onSave,
  onDelete,
}: Props) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [level1Dir, setLevel1Dir] = useState('');
  const [level2Dir, setLevel2Dir] = useState('');
  const [position, setPosition] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [mobilePhones, setMobilePhones] = useState<string[]>(['']);
  const [colorIndex, setColorIndex] = useState(-1);

  // 编辑模式：预填数据
  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setLevel1Dir(contact.level1Dir);
      setLevel2Dir(contact.level2Dir);
      setPosition(contact.position || '');
      setOfficePhone(contact.officePhone || '');
      const phones = contact.mobilePhones
        ? contact.mobilePhones.split(',').map((p) => p.trim())
        : [''];
      setMobilePhones(phones.length > 0 ? phones : ['']);
      setColorIndex(contact.colorIndex ?? -1);
    } else if (initialLevel1 || initialLevel2) {
      // 新建模式：预填目录
      if (initialLevel1) setLevel1Dir(initialLevel1);
      if (initialLevel2) setLevel2Dir(initialLevel2);
    }
  }, [contact, initialLevel1, initialLevel2]);

  const addPhone = () => {
    setMobilePhones([...mobilePhones, '']);
  };

  const removePhone = (index: number) => {
    if (mobilePhones.length <= 1) return;
    setMobilePhones(mobilePhones.filter((_, i) => i !== index));
  };

  const updatePhone = (index: number, value: string) => {
    const updated = [...mobilePhones];
    updated[index] = value;
    setMobilePhones(updated);
  };

  const handleSave = () => {
    // 验证
    if (!name.trim()) {
      Alert.alert('提示', '请输入姓名');
      return;
    }
    if (!level1Dir.trim()) {
      Alert.alert('提示', '请输入一级目录');
      return;
    }
    if (!level2Dir.trim()) {
      Alert.alert('提示', '请输入二级目录');
      return;
    }
    const validPhones = mobilePhones.filter((p) => p.trim().length > 0);

    onSave({
      name: name.trim(),
      level1Dir: level1Dir.trim(),
      level2Dir: level2Dir.trim(),
      position: position.trim(),
      officePhone: officePhone.trim(),
      mobilePhones: validPhones.length > 0 ? validPhones : [],
      colorIndex,
    });
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '确定要删除该联系人吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F5F5F7' }]} keyboardShouldPersistTaps="handled">
      {/* 姓名 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>姓名 *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
        value={name}
        onChangeText={setName}
        placeholder="请输入姓名"
        placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
      />

      {/* 头像颜色 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>头像颜色</Text>
      <View style={styles.colorRow}>
        {MorrisColors.map((mc, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              styles.colorDot,
              { backgroundColor: mc.bg },
              colorIndex === i && styles.colorDotSelected,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => setColorIndex(i)}
          />
        ))}
        <Pressable
          style={({ pressed }) => [
            styles.colorDot,
            styles.colorDotDefault,
            { backgroundColor: isDark ? '#333' : '#F0F0F3' },
            colorIndex === -1 && styles.colorDotSelected,
            pressed && { opacity: 0.6 },
          ]}
          onPress={() => setColorIndex(-1)}
        >
          <Icon name="refresh" size={20} color={isDark ? '#AAA' : '#808080'} />
        </Pressable>
      </View>

      {/* 一级目录 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>一级目录 *</Text>
      <View style={styles.chipList}>
        {level1Options.map((opt) => (
          <Pressable
            key={opt}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: isDark ? '#333' : '#F0F0F3', borderColor: isDark ? '#555' : '#E0E0E5' },
              level1Dir === opt && styles.chipSelected,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => {
              setLevel1Dir(opt);
              setLevel2Dir('');
              onLevel1Change(opt);
            }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isDark ? '#CCC' : '#505050' },
                level1Dir === opt && styles.chipTextSelected,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
        value={level1Dir}
        onChangeText={setLevel1Dir}
        placeholder="或手动输入新的一级目录"
        placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
      />

      {/* 二级目录 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>二级目录 *</Text>
      <View style={styles.chipList}>
        {level2Options.map((opt) => (
          <Pressable
            key={opt}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: isDark ? '#333' : '#F0F0F3', borderColor: isDark ? '#555' : '#E0E0E5' },
              level2Dir === opt && styles.chipSelected,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => setLevel2Dir(opt)}
          >
            <Text
              style={[
                styles.chipText,
                { color: isDark ? '#CCC' : '#505050' },
                level2Dir === opt && styles.chipTextSelected,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
        value={level2Dir}
        onChangeText={setLevel2Dir}
        placeholder="或手动输入新的二级目录"
        placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
      />

      {/* 职务 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>职务</Text>
      <TextInput
        style={[styles.input, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
        value={position}
        onChangeText={setPosition}
        placeholder="请输入职务（选填）"
        placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
      />

      {/* 办公电话 */}
      <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>办公电话</Text>
      <TextInput
        style={[styles.input, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
        value={officePhone}
        onChangeText={setOfficePhone}
        placeholder="请输入办公电话（选填）"
        placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
        keyboardType="phone-pad"
      />

      {/* 手机号（支持多个） */}
      <View style={styles.phoneHeader}>
        <Text style={[styles.label, { color: isDark ? '#CCC' : '#505050' }]}>手机号（选填）</Text>
        <Pressable onPress={addPhone}>
          <Text style={styles.addBtn}>+ 添加手机号</Text>
        </Pressable>
      </View>
      {mobilePhones.map((phone, index) => (
        <View key={index} style={styles.phoneRow}>
          <TextInput
            style={[styles.input, styles.phoneInput, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', borderColor: isDark ? '#555' : '#D0D0D5', color: isDark ? '#E0E0E0' : '#000' }]}
            value={phone}
            onChangeText={(v) => updatePhone(index, v)}
            placeholder={`手机号 ${index + 1}`}
            placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
            keyboardType="phone-pad"
          />
          {mobilePhones.length > 1 && (
            <Pressable
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
              onPress={() => removePhone(index)}
            >
              <Icon name="close" size={18} color="#FF3B30" />
            </Pressable>
          )}
        </View>
      ))}

      {/* 保存按钮 */}
      <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={handleSave}>
        <Text style={styles.saveBtnText}>保存</Text>
      </Pressable>

      {/* 删除按钮（仅编辑模式） */}
      {onDelete && (
        <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>删除联系人</Text>
        </Pressable>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.four,
    marginBottom: Spacing.one + Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  chipText: {
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  phoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  phoneInput: {
    flex: 1,
    marginTop: 0,
  },
  removeBtn: {
    marginLeft: Spacing.two,
    padding: Spacing.one,
  },
  removeBtnText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '700',
  },
  addBtn: {
    fontSize: 14,
    color: '#208AEF',
    fontWeight: '600',
    marginTop: Spacing.four,
  },
  saveBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteBtn: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteBtnText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotDefault: {
  },
  colorDotSelected: {
    borderColor: '#208AEF',
    borderWidth: 3,
  },
});
