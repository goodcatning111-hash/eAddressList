/* eslint-disable @typescript-eslint/no-deprecated */
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { getDatabase } from '@/db/database';

/** 从 URI 获取文件扩展名（小写） */
function getExtension(uri: string): string {
  const parts = uri.split('.');
  return (parts[parts.length - 1] || '').toLowerCase();
}

/** 从 URI 获取文件名 */
function getFileName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || 'file';
}

/**
 * 通用的文件导入：支持 xlsx、csv、json。
 * 对于 xlsx/csv：导入到指定通讯簿（未指定时自动选择或创建）。
 * 对于 json：作为备份恢复（会清空现有数据）。
 *
 * @param bookId 目标通讯簿 ID（可选；未提供时自动选择第一个或创建默认通讯簿）
 * @returns 导入的联系人数量，取消=-1，失败=-2
 */
export async function importFile(bookId?: number): Promise<number> {
  try {
    // 1. 选择文件
    // Android 上 MIME type 数组可能导致 JSON 被过滤，传 undefined 接受全部类型
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (result.canceled) return -1;
    const file = result.assets[0];
    const ext = getExtension(file.name || file.uri);
    const name = getFileName(file.name || file.uri);

    console.log('[Import] 选中文件:', name, '扩展名:', ext, 'URI:', file.uri);

    // 2. 根据扩展名判断类型
    if (ext === 'json') {
      // JSON 备份恢复
      await restoreFromJSONUri(file.uri);
      return -1; // 特殊标记
    }

    // 3. xlsx/csv 导入：确保有 bookId
    let targetBookId: number | undefined = bookId;
    if (targetBookId == null) {
      const id = await ensureBookId();
      if (id == null) return -2;
      targetBookId = id;
    }

    if (ext === 'csv') {
      return await importCsvFromUri(file.uri, targetBookId);
    }

    if (ext === 'xlsx' || ext === 'xls' || ext === 'et') {
      return await importXlsxFromUri(file.uri, targetBookId);
    }

    // 尝试自动检测
    console.log('[Import] 未知扩展名，尝试自动检测...');
    try {
      return await importXlsxFromUri(file.uri, targetBookId);
    } catch {
      try {
        return await importCsvFromUri(file.uri, targetBookId);
      } catch (err2) {
        console.error('[Import] 无法识别文件格式:', err2);
        Alert.alert(
          '导入失败',
          '无法识别文件格式。\n支持的文件类型：xlsx、csv、json',
        );
        return -2;
      }
    }
  } catch (err) {
    console.error('[Import] 导入失败:', err);
    Alert.alert('导入失败', '无法解析该文件，请确认格式正确。\n\n支持：xlsx、csv、json');
    return -2;
  }
}

/** 确保有通讯簿可用：有则返回第一个 ID，无则创建默认通讯簿 */
async function ensureBookId(): Promise<number | null> {
  const db = await getDatabase();
  const books = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM address_books ORDER BY id ASC LIMIT 1',
  );
  if (books.length > 0) return books[0].id;

  // 创建默认通讯簿
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO address_books (name, created_at, updated_at) VALUES (?, ?, ?)',
    '默认通讯簿',
    now,
    now,
  );
  console.log('[Import] 自动创建"默认通讯簿"，ID:', result.lastInsertRowId);
  return result.lastInsertRowId;
}

/**
 * 从 URI 读取 xlsx 文件并导入到指定通讯簿。
 * 使用 fetch + ArrayBuffer 避免 base64 编码问题。
 */
async function importXlsxFromUri(uri: string, bookId: number): Promise<number> {
  // 读取文件为 ArrayBuffer
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // 用 XLSX 解析
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  if (rows.length === 0) {
    Alert.alert('提示', '文件中没有数据');
    return -2;
  }

  // 检查列名
  const firstRow = rows[0];
  console.log('[Import] xlsx 列名:', Object.keys(firstRow));
  console.log('[Import] 共', rows.length, '行数据');

  return await insertRows(bookId, rows);
}

/**
 * 从 URI 读取 csv 文件并导入到指定通讯簿。
 */
async function importCsvFromUri(uri: string, bookId: number): Promise<number> {
  // 读取为纯文本
  const response = await fetch(uri);
  const text = await response.text();

  // 用 XLSX 解析 CSV
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  if (rows.length === 0) {
    Alert.alert('提示', '文件中没有数据');
    return -2;
  }

  console.log('[Import] csv 共', rows.length, '行数据');
  return await insertRows(bookId, rows);
}

/**
 * 将解析后的行数据批量插入数据库。
 * 支持常见列名变体。
 */
async function insertRows(
  bookId: number,
  rows: Record<string, unknown>[],
): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  let imported = 0;

  // 自动检测列名（支持多种命名，无表头时按列位置推断）
  const allKeys = Object.keys(rows[0]);

  const findKey = (row: Record<string, unknown>, positionIndex: number, ...keys: string[]): string => {
    // 先尝试通过列名匹配
    for (const key of keys) {
      if (key in row) return key;
      for (const k of allKeys) {
        const kl = k.toLowerCase().replace(/\s+/g, '');
        if (kl.includes(key.toLowerCase())) return k;
      }
    }
    // 无匹配：检查是否第一行看起来像数据（不是表头），按列位置 fallback
    const firstVal = String(row[allKeys[positionIndex]] ?? '');
    // 如果"应该是一级目录"的列的值看起来像目录名（中文），则可能无表头，直接使用位置
    if (positionIndex < allKeys.length) return allKeys[positionIndex];
    return keys[0]; // 最终 fallback
  };

  // 列索引 fallback：A=一级目录, B=二级目录, C=姓名, D=职务, E=办公电话, F=手机号
  const keyLevel1 = findKey(rows[0], 0, '一级目录', 'level1', 'level1_dir', '部门', '组织');
  const keyLevel2 = findKey(rows[0], 1, '二级目录', 'level2', 'level2_dir', '科室', '单位');
  const keyName = findKey(rows[0], 2, '姓名', 'name', '名字', '人员');
  const keyPosition = findKey(rows[0], 3, '职务', 'position', '职位', '岗位');
  const keyOfficePhone = findKey(rows[0], 4, '办公电话', 'office_phone', '办公号码', '座机');
  const keyMobile = findKey(rows[0], 5, '手机号', 'mobile', '电话', '手机', '号码');

  console.log('[Import] 检测到的列映射:', {
    level1: keyLevel1,
    level2: keyLevel2,
    name: keyName,
    position: keyPosition,
    office: keyOfficePhone,
    mobile: keyMobile,
  });

  const level1Unknown = '未分类';

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const mobileRaw = String(row[keyMobile] ?? '');
      const mobilePhones = mobileRaw
        .split(/[,，\s]+/)
        .filter((s: string) => s.trim().length > 0)
        .join(',');

      const position = row[keyPosition]
        ? String(row[keyPosition]).trim().replace(/\n/g, ' ')
        : null;
      const officePhone = row[keyOfficePhone]
        ? String(row[keyOfficePhone]).trim()
        : null;

      let name = String(row[keyName] ?? '').trim();
      if (!name) continue; // 跳过空行
      // 规范化姓名：将所有空白字符（半角空格、全角空格、制表符）合并为一个半角空格
      name = name.replace(/[\s　]+/g, ' ');
      // 如果姓名只有两个字且中间有空格，保留空格（如"陈 凯"）
      // 如果姓名三字以上且无空格，保持不变

      await db.runAsync(
        `INSERT INTO contacts
           (address_book_id, level1_dir, level2_dir, name, position, office_phone, mobile_phones, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bookId,
        String(row[keyLevel1] ?? level1Unknown).trim(),
        String(row[keyLevel2] ?? '').trim(),
        name,
        position,
        officePhone,
        mobilePhones,
        now,
        now,
      );
      imported++;
    }
  });

  console.log(`[Import] 成功导入 ${imported} 条联系人`);
  return imported;
}

/**
 * 从 JSON URI 恢复备份数据。
 */
async function restoreFromJSONUri(uri: string): Promise<void> {
  const response = await fetch(uri);
  const text = await response.text();

  let backup: any;
  try {
    backup = JSON.parse(text);
  } catch {
    Alert.alert('错误', '无效的 JSON 文件');
    return;
  }

  // 验证备份格式
  if (!backup.version && !backup.contacts) {
    Alert.alert('错误', '无效的备份文件格式。\nJSON 文件需包含 version 或 contacts 字段。');
    return;
  }

  // 确认后恢复
  const hasBooks = backup.addressBooks?.length > 0;
  const isPartial = hasBooks && backup.addressBooks?.length === 1;

  Alert.alert(
    '确认恢复',
    `即将从备份恢复数据。\n`
    + `通讯簿数：${backup.addressBooks?.length ?? 0}\n`
    + `联系人总数：${backup.contacts?.length ?? 0}`
    + (backup.directoryOrder ? `\n目录排序：${backup.directoryOrder.length} 条` : '')
    + (isPartial ? '\n\n⚠ 此备份仅含一个通讯簿，将覆盖同名通讯簿的数据。' : '\n\n⚠ 这会覆盖当前所有数据，不可撤销。'),
    [
      { text: '取消', style: 'cancel' },
      {
        text: '确定恢复',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = await getDatabase();
            await db.withTransactionAsync(async () => {
              if (isPartial) {
                // 部分恢复：只删对应通讯簿的联系人，保留其他通讯簿
                const bookId = backup.addressBooks[0].id;
                await db.runAsync('DELETE FROM directory_order WHERE address_book_id = ?', [bookId]);
                await db.runAsync('DELETE FROM contacts WHERE address_book_id = ?', [bookId]);
                // 更新或插入通讯簿本身
                const exists = await db.getFirstAsync('SELECT id FROM address_books WHERE id = ?', [bookId]);
                if (exists) {
                  await db.runAsync(
                    'UPDATE address_books SET name = ?, sort_order = ?, color_index = ?, updated_at = ? WHERE id = ?',
                    [backup.addressBooks[0].name, backup.addressBooks[0].sort_order ?? 0, backup.addressBooks[0].color_index ?? -1, Date.now(), bookId],
                  );
                } else {
                  await db.runAsync(
                    'INSERT INTO address_books (id, name, sort_order, color_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [bookId, backup.addressBooks[0].name, backup.addressBooks[0].sort_order ?? 0, backup.addressBooks[0].color_index ?? -1, backup.addressBooks[0].created_at ?? Date.now(), Date.now()],
                  );
                }
              } else {
                // 全量恢复：清空
                await db.runAsync('DELETE FROM directory_order');
                await db.runAsync('DELETE FROM contacts');
                await db.runAsync('DELETE FROM address_books');
              }

              // 通讯簿（全量恢复时插入所有）
              if (!isPartial && backup.addressBooks) {
                for (const book of backup.addressBooks) {
                  await db.runAsync(
                    `INSERT INTO address_books (id, name, sort_order, color_index, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    book.id, book.name, book.sort_order ?? 0, book.color_index ?? -1,
                    book.created_at ?? Date.now(), book.updated_at ?? Date.now(),
                  );
                }
              }

              // 联系人
              if (backup.contacts) {
                for (const contact of backup.contacts) {
                  await db.runAsync(
                    `INSERT INTO contacts
                       (id, address_book_id, level1_dir, level2_dir, name, position,
                        office_phone, mobile_phones, color_index, is_favorite, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    contact.id,
                    contact.address_book_id ?? contact.addressBookId,
                    contact.level1_dir ?? contact.level1Dir ?? '',
                    contact.level2_dir ?? contact.level2Dir ?? '',
                    contact.name ?? '',
                    contact.position ?? null,
                    contact.office_phone ?? contact.officePhone ?? null,
                    contact.mobile_phones ?? contact.mobilePhones ?? '',
                    contact.color_index ?? -1,
                    contact.is_favorite ?? 0,
                    contact.created_at ?? contact.createdAt ?? Date.now(),
                    contact.updated_at ?? contact.updatedAt ?? Date.now(),
                  );
                }
              }

              // 目录排序
              if (backup.directoryOrder) {
                for (const d of backup.directoryOrder) {
                  await db.runAsync(
                    `INSERT INTO directory_order (address_book_id, level, parent_dir, dir_name, sort_order, color_index)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    d.address_book_id, d.level, d.parent_dir ?? '', d.dir_name,
                    d.sort_order ?? 0, d.color_index ?? -1,
                  );
                }
              }
            });

            Alert.alert('成功', '数据已从备份恢复！');
          } catch (err) {
            console.error('[Import] 恢复失败:', err);
            Alert.alert('错误', '恢复失败，请重试');
          }
        },
      },
    ],
  );
}

/** ============ 导出 ============ */

export interface ExportOptions {
  /** 指定单个通讯簿 ID */
  bookId?: number;
  /** 指定多个通讯簿 ID */
  bookIds?: number[];
  /** 是否包含自定义颜色和收藏状态（默认 true） */
  includeStyles?: boolean;
}

/**
 * 导出数据为 JSON 备份文件并分享。
 * 支持按通讯簿筛选、控制是否包含样式数据。
 */
export async function exportJSON(options?: ExportOptions): Promise<void> {
  try {
    const db = await getDatabase();
    const includeStyles = options?.includeStyles !== false; // 默认 true

    // 通讯簿
    let books: any[];
    const targetIds = options?.bookIds ?? (options?.bookId != null ? [options.bookId] : null);

    if (targetIds && targetIds.length > 0) {
      const ph = targetIds.map(() => '?').join(',');
      books = await db.getAllAsync(
        `SELECT * FROM address_books WHERE id IN (${ph})`,
        targetIds,
      );
    } else {
      books = await db.getAllAsync('SELECT * FROM address_books');
    }

    const bookIds = books.map((b: any) => b.id);

    // 联系人
    let contacts: any[];
    if (targetIds && targetIds.length > 0) {
      const ph = targetIds.map(() => '?').join(',');
      contacts = await db.getAllAsync(
        `SELECT * FROM contacts WHERE address_book_id IN (${ph})`,
        targetIds,
      );
    } else {
      contacts = await db.getAllAsync('SELECT * FROM contacts');
    }

    // 目录排序
    let dirOrder: any[] = [];
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(',');
      dirOrder = await db.getAllAsync(
        `SELECT * FROM directory_order WHERE address_book_id IN (${placeholders})`,
        bookIds,
      );
    }

    // 如果不包含样式，去掉相关字段
    const cleanContacts = contacts.map((c: any) => {
      const { color_index, is_favorite, ...rest } = c;
      return includeStyles ? c : rest;
    });
    const cleanDirOrder = dirOrder.map((d: any) => {
      const { color_index, ...rest } = d;
      return includeStyles ? d : rest;
    });
    const cleanBooks = books.map((b: any) => {
      const { color_index, ...rest } = b;
      return includeStyles ? b : rest;
    });

    const backup = {
      version: includeStyles ? 2 : 1,
      exportedAt: Date.now(),
      addressBooks: cleanBooks,
      contacts: cleanContacts,
      directoryOrder: cleanDirOrder,
    };

    const scope = books.length === 1
      ? books[0]?.name ?? 'partial'
      : 'selection';
    const styleTag = includeStyles ? '' : '_nostyle';
    const jsonString = JSON.stringify(backup, null, 2);
    const fileName = `eAddressList_${scope}_${new Date().toISOString().slice(0, 10)}${styleTag}.json`;
    const filePath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, jsonString);

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('提示', `备份文件已保存`);
      return;
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: '分享通讯录备份',
    });
  } catch (err) {
    console.error('[Export] 导出失败:', err);
    Alert.alert('导出失败', '请重试');
  }
}

/** 生成并分享通讯录导入模板（xlsx） */
export async function shareTemplate(): Promise<void> {
  try {
    // 直接用 xlsx 库生成模板，包含表头 + 一行示例数据
    const header = ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'];
    const example = ['办公室', '综合科', '张三', '经理', '010-12345678', '13800138000'];
    const sheet = XLSX.utils.aoa_to_sheet([header, example]);
    // 设置列宽
    sheet['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '通讯录');

    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filePath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}通讯录模板.xlsx`;
    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: '下载通讯录模板',
    });
  } catch (err) {
    console.error('[Template] 分享模板失败:', err);
    Alert.alert('提示', '分享模板失败，请重试');
  }
}

/** 导出联系人为 Excel（与导入模板格式一致，可按通讯簿筛选） */
export async function exportExcel(bookIds?: number[]): Promise<void> {
  try {
    const db = await getDatabase();

    let contacts: any[];
    if (bookIds && bookIds.length > 0) {
      const ph = bookIds.map(() => '?').join(',');
      contacts = await db.getAllAsync<any>(
        `SELECT c.level1_dir, c.level2_dir, c.name, c.position, c.office_phone, c.mobile_phones
         FROM contacts c
         JOIN address_books ab ON c.address_book_id = ab.id
         WHERE c.address_book_id IN (${ph})
         ORDER BY ab.sort_order, c.level1_dir, c.level2_dir, c.name`,
        bookIds,
      );
    } else {
      contacts = await db.getAllAsync<any>(
        `SELECT c.level1_dir, c.level2_dir, c.name, c.position, c.office_phone, c.mobile_phones
         FROM contacts c
         JOIN address_books ab ON c.address_book_id = ab.id
         ORDER BY ab.sort_order, c.level1_dir, c.level2_dir, c.name`,
      );
    }

    if (contacts.length === 0) {
      Alert.alert('提示', '暂无联系人数据可导出');
      return;
    }

    const header = ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'];
    const rows = contacts.map((c: any) => [
      c.level1_dir ?? '',
      c.level2_dir ?? '',
      c.name ?? '',
      c.position ?? '',
      c.office_phone ?? '',
      c.mobile_phones ?? '',
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheet['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '通讯录');

    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const fileName = `通讯录_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filePath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: '导出通讯录 Excel',
    });
  } catch (err) {
    console.error('[ExportExcel] 导出失败:', err);
    Alert.alert('导出失败', '请重试');
  }
}
