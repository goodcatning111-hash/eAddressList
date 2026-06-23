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
import { Spacing } from '@/constants/theme';
import { MorrisColors } from '@/constants/colors';
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
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* 姓名 */}
      <Text style={styles.label}>姓名 *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="请输入姓名"
      />

      {/* 头像颜色 */}
      <Text style={styles.label}>头像颜色</Text>
      <View style={styles.colorRow}>
        {MorrisColors.map((mc, i) => (
          <Pressable
            key={i}
            style={[
              styles.colorDot,
              { backgroundColor: mc.bg },
              colorIndex === i && styles.colorDotSelected,
            ]}
            onPress={() => setColorIndex(i)}
          />
        ))}
        <Pressable
          style={[
            styles.colorDot,
            styles.colorDotDefault,
            colorIndex === -1 && styles.colorDotSelected,
          ]}
          onPress={() => setColorIndex(-1)}
        >
          <Text style={{ fontSize: 14, color: '#808080' }}>↺</Text>
        </Pressable>
      </View>

      {/* 一级目录 */}
      <Text style={styles.label}>一级目录 *</Text>
      <View style={styles.chipList}>
        {level1Options.map((opt) => (
          <Pressable
            key={opt}
            style={[
              styles.chip,
              level1Dir === opt && styles.chipSelected,
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
                level1Dir === opt && styles.chipTextSelected,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={level1Dir}
        onChangeText={setLevel1Dir}
        placeholder="或手动输入新的一级目录"
      />

      {/* 二级目录 */}
      <Text style={styles.label}>二级目录 *</Text>
      <View style={styles.chipList}>
        {level2Options.map((opt) => (
          <Pressable
            key={opt}
            style={[
              styles.chip,
              level2Dir === opt && styles.chipSelected,
            ]}
            onPress={() => setLevel2Dir(opt)}
          >
            <Text
              style={[
                styles.chipText,
                level2Dir === opt && styles.chipTextSelected,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={level2Dir}
        onChangeText={setLevel2Dir}
        placeholder="或手动输入新的二级目录"
      />

      {/* 职务 */}
      <Text style={styles.label}>职务</Text>
      <TextInput
        style={styles.input}
        value={position}
        onChangeText={setPosition}
        placeholder="请输入职务（选填）"
      />

      {/* 办公电话 */}
      <Text style={styles.label}>办公电话</Text>
      <TextInput
        style={styles.input}
        value={officePhone}
        onChangeText={setOfficePhone}
        placeholder="请输入办公电话（选填）"
        keyboardType="phone-pad"
      />

      {/* 手机号（支持多个） */}
      <View style={styles.phoneHeader}>
        <Text style={styles.label}>手机号（选填）</Text>
        <Pressable onPress={addPhone}>
          <Text style={styles.addBtn}>+ 添加手机号</Text>
        </Pressable>
      </View>
      {mobilePhones.map((phone, index) => (
        <View key={index} style={styles.phoneRow}>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={phone}
            onChangeText={(v) => updatePhone(index, v)}
            placeholder={`手机号 ${index + 1}`}
            keyboardType="phone-pad"
          />
          {mobilePhones.length > 1 && (
            <Pressable
              style={styles.removeBtn}
              onPress={() => removePhone(index)}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      {/* 保存按钮 */}
      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>保存</Text>
      </Pressable>

      {/* 删除按钮（仅编辑模式） */}
      {onDelete && (
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
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
    color: '#505050',
    marginTop: Spacing.four,
    marginBottom: Spacing.one + Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D5',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F0F0F3',
    borderWidth: 1,
    borderColor: '#E0E0E5',
  },
  chipSelected: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  chipText: {
    fontSize: 13,
    color: '#505050',
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
    backgroundColor: '#F0F0F3',
  },
  colorDotSelected: {
    borderColor: '#208AEF',
    borderWidth: 3,
  },
});
