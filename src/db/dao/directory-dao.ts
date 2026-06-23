import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../database';
import type { DirectoryNode } from '../types';

/**
 * 获取目录排序值。
 * 先在 directory_order 表中查找，没有则默认 0。
 */
async function getDirOrder(
  db: SQLite.SQLiteDatabase,
  bookId: number,
  level: number,
  parentDir: string,
  dirName: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ sort_order: number }>(
    `SELECT sort_order FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND dir_name = ?`,
    [bookId, level, parentDir, dirName],
  );
  return row?.sort_order ?? 9999; // 未排序的排最后
}

/** 确保目录在 directory_order 表中有条目 */
async function ensureDirOrder(
  db: SQLite.SQLiteDatabase,
  bookId: number,
  level: number,
  parentDir: string,
  dirName: string,
): Promise<void> {
  const exists = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND dir_name = ?`,
    [bookId, level, parentDir, dirName],
  );
  if (!exists) {
    const maxRow = await db.getFirstAsync<{ m: number }>(
      `SELECT MAX(sort_order) AS m FROM directory_order
       WHERE address_book_id = ? AND level = ? AND parent_dir = ?`,
      [bookId, level, parentDir],
    );
    await db.runAsync(
      `INSERT INTO directory_order (address_book_id, level, parent_dir, dir_name, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [bookId, level, parentDir, dirName, (maxRow?.m ?? -1) + 1],
    );
  }
}

/** 获取完整目录树 */
export async function getDirectoryTree(bookId: number): Promise<DirectoryNode[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    level1_dir: string;
    level2_dir: string;
    cnt: number;
  }>(
    `SELECT level1_dir, level2_dir, COUNT(*) AS cnt
     FROM contacts
     WHERE address_book_id = ?
     GROUP BY level1_dir, level2_dir
     ORDER BY level1_dir, level2_dir`,
    [bookId],
  );

  // 获取所有一级目录排序
  const l1Set = new Set(rows.map((r) => r.level1_dir));
  const l1Orders = new Map<string, number>();
  for (const l1 of l1Set) {
    l1Orders.set(l1, await getDirOrder(db, bookId, 1, '', l1));
  }

  // 构建树
  const map = new Map<string, { name: string; count: number; order: number }[]>();
  for (const row of rows) {
    if (!map.has(row.level1_dir)) map.set(row.level1_dir, []);
    const order = await getDirOrder(db, bookId, 2, row.level1_dir, row.level2_dir);
    map.get(row.level1_dir)!.push({
      name: row.level2_dir,
      count: row.cnt,
      order,
    });
  }

  // 排序：一级按 sort_order，二级也按 sort_order
  const sortedL1 = Array.from(l1Set).sort(
    (a, b) => (l1Orders.get(a) ?? 9999) - (l1Orders.get(b) ?? 9999),
  );

  return sortedL1.map((level1Dir) => {
    const level2Dirs = (map.get(level1Dir) || [])
      .sort((a, b) => a.order - b.order)
      .map(({ name, count }) => ({ name, count }));
    return {
      level1Dir,
      level2Dirs,
      totalCount: level2Dirs.reduce((sum, d) => sum + d.count, 0),
    };
  });
}

// ============ 目录 CRUD ============

/** 新建一级目录（在 address_book 中创建一个占位联系人） */
export async function createLevel1Dir(
  bookId: number,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO contacts (address_book_id, level1_dir, level2_dir, name, mobile_phones, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookId, dirName, '未分组', '（待添加）', '', now, now],
    );
    await ensureDirOrder(db, bookId, 1, '', dirName);
  });
}

/** 新建二级目录 */
export async function createLevel2Dir(
  bookId: number,
  level1Dir: string,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO contacts (address_book_id, level1_dir, level2_dir, name, mobile_phones, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookId, level1Dir, dirName, '（待添加）', '', now, now],
    );
    await ensureDirOrder(db, bookId, 2, level1Dir, dirName);
  });
}

/** 重命名一级目录（更新所有相关联系人和 directory_order） */
export async function renameLevel1Dir(
  bookId: number,
  oldName: string,
  newName: string,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE contacts SET level1_dir = ?, updated_at = ? WHERE address_book_id = ? AND level1_dir = ?',
      [newName, Date.now(), bookId, oldName],
    );
    await db.runAsync(
      `UPDATE directory_order SET dir_name = ? WHERE address_book_id = ? AND level = 1 AND dir_name = ?`,
      [newName, bookId, oldName],
    );
    // 更新二级目录的 parent_dir
    await db.runAsync(
      `UPDATE directory_order SET parent_dir = ? WHERE address_book_id = ? AND level = 2 AND parent_dir = ?`,
      [newName, bookId, oldName],
    );
  });
}

/** 重命名二级目录 */
export async function renameLevel2Dir(
  bookId: number,
  level1Dir: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE contacts SET level2_dir = ?, updated_at = ? WHERE address_book_id = ? AND level1_dir = ? AND level2_dir = ?',
      [newName, Date.now(), bookId, level1Dir, oldName],
    );
    await db.runAsync(
      `UPDATE directory_order SET dir_name = ? WHERE address_book_id = ? AND level = 2 AND parent_dir = ? AND dir_name = ?`,
      [newName, bookId, level1Dir, oldName],
    );
  });
}

/** 删除一级目录及其所有联系人 */
export async function deleteLevel1Dir(
  bookId: number,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM contacts WHERE address_book_id = ? AND level1_dir = ?',
      [bookId, dirName],
    );
    await db.runAsync(
      'DELETE FROM directory_order WHERE address_book_id = ? AND level = 1 AND dir_name = ?',
      [bookId, dirName],
    );
    await db.runAsync(
      'DELETE FROM directory_order WHERE address_book_id = ? AND level = 2 AND parent_dir = ?',
      [bookId, dirName],
    );
  });
}

/** 删除二级目录及其所有联系人 */
export async function deleteLevel2Dir(
  bookId: number,
  level1Dir: string,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM contacts WHERE address_book_id = ? AND level1_dir = ? AND level2_dir = ?',
      [bookId, level1Dir, dirName],
    );
    await db.runAsync(
      'DELETE FROM directory_order WHERE address_book_id = ? AND level = 2 AND parent_dir = ? AND dir_name = ?',
      [bookId, level1Dir, dirName],
    );
  });
}

/** 上移一条目录排序 */
export async function moveDirUp(
  bookId: number,
  level: number,
  parentDir: string,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ id: number; sort_order: number }>(
    `SELECT id, sort_order FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND dir_name = ?`,
    [bookId, level, parentDir, dirName],
  );
  if (!current) return;

  const prev = await db.getFirstAsync<{ id: number; sort_order: number }>(
    `SELECT id, sort_order FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND sort_order < ?
     ORDER BY sort_order DESC LIMIT 1`,
    [bookId, level, parentDir, current.sort_order],
  );
  if (!prev) return;

  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [prev.sort_order, current.id]);
  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [current.sort_order, prev.id]);
}

/** 设置目录的自定义颜色索引（-1 表示恢复默认） */
export async function setDirColor(
  bookId: number,
  level: number,
  parentDir: string,
  dirName: string,
  colorIndex: number,
): Promise<void> {
  const db = await getDatabase();
  // 确保目录在 directory_order 中有条目
  await ensureDirOrder(db, bookId, level, parentDir, dirName);
  await db.runAsync(
    `UPDATE directory_order SET color_index = ?
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND dir_name = ?`,
    [colorIndex, bookId, level, parentDir, dirName],
  );
}

/** 确保所有已有目录在 directory_order 表中有排序条目（首次编辑模式触发） */
export async function syncAllDirOrders(bookId: number): Promise<void> {
  const db = await getDatabase();

  // 一级目录
  const l1Dirs = await db.getAllAsync<{ d: string }>(
    'SELECT DISTINCT level1_dir AS d FROM contacts WHERE address_book_id = ?',
    [bookId],
  );
  for (const row of l1Dirs) {
    await ensureDirOrder(db, bookId, 1, '', row.d);
  }

  // 二级目录
  const l2Dirs = await db.getAllAsync<{ l1: string; l2: string }>(
    'SELECT DISTINCT level1_dir AS l1, level2_dir AS l2 FROM contacts WHERE address_book_id = ?',
    [bookId],
  );
  for (const row of l2Dirs) {
    await ensureDirOrder(db, bookId, 2, row.l1, row.l2);
  }
}

/** 下移一条目录排序 */
export async function moveDirDown(
  bookId: number,
  level: number,
  parentDir: string,
  dirName: string,
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ id: number; sort_order: number }>(
    `SELECT id, sort_order FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND dir_name = ?`,
    [bookId, level, parentDir, dirName],
  );
  if (!current) return;

  const next = await db.getFirstAsync<{ id: number; sort_order: number }>(
    `SELECT id, sort_order FROM directory_order
     WHERE address_book_id = ? AND level = ? AND parent_dir = ? AND sort_order > ?
     ORDER BY sort_order ASC LIMIT 1`,
    [bookId, level, parentDir, current.sort_order],
  );
  if (!next) return;

  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [next.sort_order, current.id]);
  await db.runAsync('UPDATE directory_order SET sort_order = ? WHERE id = ?', [current.sort_order, next.id]);
}
