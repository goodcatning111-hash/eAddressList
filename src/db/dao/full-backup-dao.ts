import { getDatabase } from '../database';
import type { SaveData } from '@/utils/save-manager';

/** 导出全部数据：通讯簿、联系人、目录排序（含自定义色、收藏、排序） */
export async function exportFullData(): Promise<SaveData> {
  const db = await getDatabase();

  const addressBooks = await db.getAllAsync<any>(
    'SELECT id, name, sort_order, color_index, created_at, updated_at FROM address_books ORDER BY sort_order',
  );
  const contacts = await db.getAllAsync<any>(
    'SELECT address_book_id, level1_dir, level2_dir, name, position, office_phone, mobile_phones, color_index, is_favorite, created_at, updated_at FROM contacts ORDER BY address_book_id, level1_dir, level2_dir, id',
  );
  const directoryOrder = await db.getAllAsync<any>(
    'SELECT address_book_id, level, parent_dir, dir_name, sort_order, color_index FROM directory_order ORDER BY address_book_id, level, parent_dir, sort_order',
  );

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    addressBooks,
    contacts,
    directoryOrder,
  };
}

/** 导入全量数据：清空现有数据，写入存档（事务保护） */
export async function importFullData(data: SaveData): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // 清空所有数据（外键 CASCADE）
    await db.runAsync('DELETE FROM directory_order');
    await db.runAsync('DELETE FROM contacts');
    await db.runAsync('DELETE FROM address_books');

    // 恢复通讯簿
    for (const ab of data.addressBooks) {
      await db.runAsync(
        `INSERT INTO address_books (id, name, sort_order, color_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ab.id, ab.name, ab.sort_order ?? 0, ab.color_index ?? -1, ab.created_at, ab.updated_at],
      );
    }

    // 恢复联系人
    for (const c of data.contacts) {
      await db.runAsync(
        `INSERT INTO contacts (address_book_id, level1_dir, level2_dir, name, position, office_phone, mobile_phones, color_index, is_favorite, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.address_book_id, c.level1_dir, c.level2_dir, c.name,
          c.position ?? null, c.office_phone ?? null, c.mobile_phones ?? '',
          c.color_index ?? -1, c.is_favorite ?? 0, c.created_at, c.updated_at,
        ],
      );
    }

    // 恢复目录排序
    for (const d of data.directoryOrder) {
      await db.runAsync(
        `INSERT INTO directory_order (address_book_id, level, parent_dir, dir_name, sort_order, color_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.address_book_id, d.level, d.parent_dir, d.dir_name, d.sort_order ?? 0, d.color_index ?? -1],
      );
    }
  });
}
