import { getDatabase } from '../database';
import { getMorrisColor } from '@/constants/colors';
import type { AddressBook } from '../types';

/** 获取通讯簿应显示的颜色：优先用 color_index，否则用 id 决定 */
export function getBookColor(book: { id: number; colorIndex?: number }) {
  const idx = (book.colorIndex != null && book.colorIndex >= 0)
    ? book.colorIndex
    : book.id;
  return getMorrisColor(idx);
}

/** 更新通讯簿颜色索引 */
export async function setColor(id: number, colorIndex: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE address_books SET color_index = ?, updated_at = ? WHERE id = ?',
    [colorIndex, Date.now(), id],
  );
}

/** 获取所有通讯簿（按 sort_order 排序） */
export async function getAll(): Promise<AddressBook[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    sort_order: number;
    color_index: number;
    created_at: number;
    updated_at: number;
    cnt: number;
  }>(
    `SELECT ab.*, ab.color_index, COUNT(c.id) AS cnt
     FROM address_books ab
     LEFT JOIN contacts c ON c.address_book_id = ab.id
     GROUP BY ab.id
     ORDER BY ab.sort_order ASC, ab.id ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contactCount: r.cnt,
    colorIndex: r.color_index ?? -1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** 通过 ID 获取单个通讯簿 */
export async function getById(id: number): Promise<AddressBook | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    color_index: number;
    created_at: number;
    updated_at: number;
    cnt: number;
  }>(
    `SELECT ab.*, ab.color_index, COUNT(c.id) AS cnt
     FROM address_books ab
     LEFT JOIN contacts c ON c.address_book_id = ab.id
     WHERE ab.id = ?
     GROUP BY ab.id`,
    [id],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    contactCount: row.cnt,
    colorIndex: row.color_index ?? -1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 新建通讯簿，返回新 ID */
export async function create(name: string): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  // 新通讯簿排最后
  const maxRow = await db.getFirstAsync<{ m: number }>(
    'SELECT MAX(sort_order) AS m FROM address_books',
  );
  const nextOrder = (maxRow?.m ?? -1) + 1;
  const result = await db.runAsync(
    'INSERT INTO address_books (name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [name, nextOrder, now, now],
  );
  return result.lastInsertRowId;
}

/** 重命名通讯簿 */
export async function rename(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE address_books SET name = ?, updated_at = ? WHERE id = ?',
    [name, Date.now(), id],
  );
}

/** 更新通讯簿名称（保留兼容） */
export async function update(id: number, name: string): Promise<void> {
  return rename(id, name);
}

/** 删除通讯簿（CASCADE 会同时删除其下联系人和目录排序） */
export async function remove(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM address_books WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM directory_order WHERE address_book_id = ?', [id]);
}

/** 批量重排：按 ID 数组顺序更新所有通讯簿的 sort_order */
export async function reorderAll(ids: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.runAsync('UPDATE address_books SET sort_order = ? WHERE id = ?', [i, ids[i]]);
    }
  });
}

/** 交换两个通讯簿的 sort_order */
export async function swapOrder(idA: number, idB: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const a = await db.getFirstAsync<{ sort_order: number }>(
      'SELECT sort_order FROM address_books WHERE id = ?',
      [idA],
    );
    const b = await db.getFirstAsync<{ sort_order: number }>(
      'SELECT sort_order FROM address_books WHERE id = ?',
      [idB],
    );
    if (a && b) {
      await db.runAsync('UPDATE address_books SET sort_order = ? WHERE id = ?', [b.sort_order, idA]);
      await db.runAsync('UPDATE address_books SET sort_order = ? WHERE id = ?', [a.sort_order, idB]);
    }
  });
}
