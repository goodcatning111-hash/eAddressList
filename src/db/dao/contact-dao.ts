import { getDatabase } from '../database';
import type { Contact, ContactFormData, Level1Summary, Level2Group } from '../types';

/** 将 ContactFormData 的 mobilePhones 数组转为逗号分隔字符串 */
function joinPhones(phones: string[]): string {
  return phones.filter((p) => p.trim().length > 0).join(',');
}

/** 将数据库行转为 Contact */
function rowToContact(row: any): Contact {
  return {
    id: row.id,
    addressBookId: row.address_book_id,
    level1Dir: row.level1_dir,
    level2Dir: row.level2_dir,
    name: row.name,
    position: row.position,
    officePhone: row.office_phone,
    mobilePhones: row.mobile_phones,
    colorIndex: row.color_index ?? -1,
    isFavorite: !!(row.is_favorite ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 获取某通讯簿下所有联系人（可选搜索过滤） */
export async function getByBookId(
  bookId: number,
  search?: string,
): Promise<Contact[]> {
  const db = await getDatabase();
  if (search && search.trim().length > 0) {
    // 忽略所有空白字符（半角空格、全角空格、制表符等）
    const q = search.trim().replace(/[\s　]+/g, '');
    const keyword = `%${q}%`;
    // SQLite: 同时替换半角空格 ' ' 和全角空格 '　'
    const NOSP = "REPLACE(REPLACE(COALESCE(";
    const NOSP_END = ", ''), ' ', ''), '　', '')";
    const rows = await db.getAllAsync(
      `SELECT * FROM contacts
       WHERE address_book_id = ?
         AND (${NOSP}name${NOSP_END} LIKE ?
           OR ${NOSP}position${NOSP_END} LIKE ?
           OR ${NOSP}level1_dir${NOSP_END} LIKE ?
           OR ${NOSP}level2_dir${NOSP_END} LIKE ?
           OR ${NOSP}mobile_phones${NOSP_END} LIKE ?
           OR ${NOSP}office_phone${NOSP_END} LIKE ?)
       ORDER BY level1_dir, level2_dir, id`,
      [bookId, keyword, keyword, keyword, keyword, keyword, keyword],
    );
    return dedupContacts(rows.map(rowToContact));
  }
  const rows = await db.getAllAsync(
    'SELECT * FROM contacts WHERE address_book_id = ? ORDER BY level1_dir, level2_dir, id',
    [bookId],
  );
  return rows.map(rowToContact);
}

const STRIP_SPACES = (s: string) => s.replace(/[\s　]+/g, '');

/** 去重：按 (通讯簿ID, 目录, 姓名) 合并——全部字段先去掉空格再比对 */
function dedupContacts(list: Contact[]): Contact[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = [
      c.addressBookId,
      STRIP_SPACES(c.level1Dir),
      STRIP_SPACES(c.level2Dir),
      STRIP_SPACES(c.name),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 跨所有通讯簿搜索联系人（全局搜索，模糊匹配全部字段） */
export async function searchAll(query: string): Promise<Contact[]> {
  const db = await getDatabase();
  const q = query.trim().replace(/[\s　]+/g, '');
  const keyword = `%${q}%`;
  const NOSP = "REPLACE(REPLACE(COALESCE(";
  const NOSP_END = ", ''), ' ', ''), '　', '')";

  // 与 getByBookId 保持一致的策略：SELECT * + dedupContacts，
  // 不使用 GROUP BY——GROUP BY 会在去空格之前就按原始 name 分
  // 组，造成同名但空格数不同的行被拆成多条。
  const rows = await db.getAllAsync(
    `SELECT * FROM contacts
     WHERE ${NOSP}name${NOSP_END} LIKE ?
        OR ${NOSP}position${NOSP_END} LIKE ?
        OR ${NOSP}level1_dir${NOSP_END} LIKE ?
        OR ${NOSP}level2_dir${NOSP_END} LIKE ?
        OR ${NOSP}mobile_phones${NOSP_END} LIKE ?
        OR ${NOSP}office_phone${NOSP_END} LIKE ?
     ORDER BY level1_dir, level2_dir`,
    [keyword, keyword, keyword, keyword, keyword, keyword],
  );
  return dedupContacts(rows.map(rowToContact));
}

/** 跨所有通讯簿搜索（含通讯簿名称，用于全局搜索分组展示） */
export async function searchAllWithBookName(
  query: string,
): Promise<(Contact & { bookName: string })[]> {
  const db = await getDatabase();
  const q = query.trim().replace(/[\s　]+/g, '');
  const keyword = `%${q}%`;
  const NOSP = "REPLACE(REPLACE(COALESCE(";
  const NOSP_END = ", ''), ' ', ''), '　', '')";

  const rows = await db.getAllAsync<any>(
    `SELECT c.*, a.name AS book_name
     FROM contacts c
     JOIN address_books a ON a.id = c.address_book_id
     WHERE ${NOSP}c.name${NOSP_END} LIKE ?
        OR ${NOSP}c.position${NOSP_END} LIKE ?
        OR ${NOSP}c.level1_dir${NOSP_END} LIKE ?
        OR ${NOSP}c.level2_dir${NOSP_END} LIKE ?
        OR ${NOSP}c.mobile_phones${NOSP_END} LIKE ?
        OR ${NOSP}c.office_phone${NOSP_END} LIKE ?
     ORDER BY a.sort_order, c.level1_dir, c.level2_dir`,
    [keyword, keyword, keyword, keyword, keyword, keyword],
  );

  return dedupContacts(rows.map((row) => ({
    ...rowToContact(row),
    bookName: row.book_name as string,
  }))) as (Contact & { bookName: string })[];
}

/** 通过 ID 获取单个联系人 */
export async function getById(id: number): Promise<Contact | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT * FROM contacts WHERE id = ?',
    id,
  );
  if (!row) return null;
  return rowToContact(row);
}

/** 新建联系人 */
export async function create(
  bookId: number,
  data: ContactFormData,
): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO contacts
       (address_book_id, level1_dir, level2_dir, name, position, office_phone, mobile_phones, color_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bookId,
    data.level1Dir,
    data.level2Dir,
    data.name,
    data.position || null,
    data.officePhone || null,
    joinPhones(data.mobilePhones),
    data.colorIndex ?? -1,
    now,
    now,
  );
  return result.lastInsertRowId;
}

/** 更新联系人 */
export async function update(
  id: number,
  data: ContactFormData,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE contacts
     SET level1_dir = ?, level2_dir = ?, name = ?, position = ?,
         office_phone = ?, mobile_phones = ?, color_index = ?, updated_at = ?
     WHERE id = ?`,
    data.level1Dir,
    data.level2Dir,
    data.name,
    data.position || null,
    data.officePhone || null,
    joinPhones(data.mobilePhones),
    data.colorIndex ?? -1,
    now,
    id,
  );
}

/** 删除联系人 */
export async function remove(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM contacts WHERE id = ?', id);
}

/** 批量导入（在事务中使用更快） */
export async function batchCreate(
  bookId: number,
  contacts: ContactFormData[],
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const data of contacts) {
      await db.runAsync(
        `INSERT INTO contacts
           (address_book_id, level1_dir, level2_dir, name, position, office_phone, mobile_phones, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bookId,
        data.level1Dir,
        data.level2Dir,
        data.name,
        data.position || null,
        data.officePhone || null,
        joinPhones(data.mobilePhones),
        now,
        now,
      );
    }
  });
}

/** 获取某通讯簿下的一级目录列表及各自联系人数量（按 directory_order 排序） */
export async function getLevel1Dirs(
  bookId: number,
): Promise<Level1Summary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ level1_dir: string; cnt: number; color_index: number }>(
    `SELECT c.level1_dir, COUNT(*) AS cnt,
            COALESCE(d.color_index, -1) AS color_index
     FROM contacts c
     LEFT JOIN directory_order d
       ON d.address_book_id = c.address_book_id AND d.level = 1 AND d.dir_name = c.level1_dir
     WHERE c.address_book_id = ?
     GROUP BY c.level1_dir
     ORDER BY (SELECT COALESCE(d2.sort_order, 9999) FROM directory_order d2
       WHERE d2.address_book_id = c.address_book_id AND d2.level = 1 AND d2.dir_name = c.level1_dir)`,
    [bookId],
  );
  return rows.map((r) => ({ level1Dir: r.level1_dir, count: r.cnt, colorIndex: r.color_index }));
}

/** 获取某通讯簿某一级目录下的二级目录分组及联系人（按 directory_order 排序） */
export async function getLevel2Groups(
  bookId: number,
  level1Dir: string,
): Promise<Level2Group[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT c.*,
            COALESCE(d.color_index, -1) AS dir_color_index
     FROM contacts c
     LEFT JOIN directory_order d
       ON d.address_book_id = ? AND d.level = 2 AND d.parent_dir = ? AND d.dir_name = c.level2_dir
     WHERE c.address_book_id = ? AND c.level1_dir = ?
     ORDER BY (
       SELECT COALESCE(d2.sort_order, 9999) FROM directory_order d2
       WHERE d2.address_book_id = ? AND d2.level = 2 AND d2.parent_dir = ? AND d2.dir_name = c.level2_dir
     ), c.id`,
    [bookId, level1Dir, bookId, level1Dir, bookId, level1Dir],
  );

  // 按 level2_dir 分组（保持查询顺序），取第一个 dir_color_index
  const map = new Map<string, { contacts: Contact[]; colorIndex: number }>();
  for (const row of rows) {
    const key = row.level2_dir;
    if (!map.has(key)) {
      map.set(key, { contacts: [], colorIndex: row.dir_color_index as number });
    }
    map.get(key)!.contacts.push(rowToContact(row));
  }

  return Array.from(map.entries()).map(([level2Dir, { contacts, colorIndex }]) => ({
    level2Dir,
    contacts,
    colorIndex,
  }));
}

/** 获取所有已用的一级目录名称（用于表单下拉选择） */
export async function getAllLevel1Dirs(bookId: number): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ level1_dir: string }>(
    'SELECT DISTINCT level1_dir FROM contacts WHERE address_book_id = ? ORDER BY level1_dir',
    bookId,
  );
  return rows.map((r) => r.level1_dir);
}

/** 获取某一级目录下的所有二级目录名称 */
export async function getLevel2Dirs(
  bookId: number,
  level1Dir: string,
): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ level2_dir: string }>(
    'SELECT DISTINCT level2_dir FROM contacts WHERE address_book_id = ? AND level1_dir = ? ORDER BY level2_dir',
    bookId,
    level1Dir,
  );
  return rows.map((r) => r.level2_dir);
}

/** 切换联系人的收藏状态 */
export async function toggleFavorite(id: number, value: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE contacts SET is_favorite = ?, updated_at = ? WHERE id = ?',
    [value ? 1 : 0, Date.now(), id],
  );
}

/** 获取所有已收藏的联系人（跨所有通讯簿，含通讯簿名称） */
export async function getFavorites(): Promise<(Contact & { bookName: string })[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT c.*, a.name AS book_name
     FROM contacts c
     JOIN address_books a ON a.id = c.address_book_id
     WHERE c.is_favorite = 1
     ORDER BY a.sort_order, c.name`,
  );
  return rows.map((row) => ({
    ...rowToContact(row),
    bookName: row.book_name as string,
  }));
}

/** 清理重复联系人：同通讯簿、同目录、同姓名的只保留一条（全部去空格比对） */
export async function cleanupDuplicates(): Promise<number> {
  const db = await getDatabase();
  let removed = 0;

  const STRIP = (col: string) => `REPLACE(REPLACE(${col}, ' ', ''), '　', '')`;

  // 所有关键字段都去空格后再分组
  const dups = await db.getAllAsync<{
    address_book_id: number;
    norm_l1: string;
    norm_l2: string;
    norm_name: string;
    ids: string;
    cnt: number;
  }>(
    `SELECT address_book_id,
            ${STRIP('level1_dir')} AS norm_l1,
            ${STRIP('level2_dir')} AS norm_l2,
            ${STRIP('name')} AS norm_name,
            GROUP_CONCAT(id) AS ids, COUNT(*) AS cnt
     FROM contacts
     GROUP BY address_book_id, norm_l1, norm_l2, norm_name
     HAVING cnt > 1`,
  );

  for (const group of dups) {
    const idList = group.ids.split(',').map(Number);
    const keepId = Math.max(...idList);
    const deleteIds = idList.filter((id) => id !== keepId);

    // 合并被删行的自定义色和收藏状态到保留行
    const deleted = await db.getAllAsync<{ color_index: number; is_favorite: number }>(
      `SELECT color_index, is_favorite FROM contacts WHERE id IN (${deleteIds.join(',')})`,
    );
    const bestColor = deleted.reduce((best, r) => r.color_index >= 0 ? r.color_index : best, -1);
    const bestFav = deleted.some((r) => r.is_favorite === 1);

    if (bestColor >= 0 || bestFav) {
      const updates: string[] = [];
      const vals: any[] = [];
      if (bestColor >= 0) { updates.push('color_index = ?'); vals.push(bestColor); }
      if (bestFav) { updates.push('is_favorite = 1'); }
      vals.push(keepId);
      await db.runAsync(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, vals);
    }

    await db.runAsync(`DELETE FROM contacts WHERE id IN (${deleteIds.join(',')})`);
    removed += deleteIds.length;
  }

  return removed;
}

/** 诊断：返回各 address_book_id 的分布（含不存在的 book） */
export async function countByBook(): Promise<
  { bookId: number; bookName: string; count: number }[]
> {
  const db = await getDatabase();
  return db.getAllAsync<{ bookId: number; bookName: string; count: number }>(
    `SELECT c.address_book_id AS bookId,
            COALESCE(ab.name, '(已删除的通讯簿)') AS bookName,
            COUNT(*) AS count
     FROM contacts c
     LEFT JOIN address_books ab ON ab.id = c.address_book_id
     GROUP BY c.address_book_id
     ORDER BY count DESC`,
  );
}

/** 诊断：返回联系人表的总行数 */
export async function countAll(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM contacts',
  );
  return row?.cnt ?? 0;
}

/** 清理占位联系人和多余数据（孤立行） */
export async function cleanupOrphans(): Promise<{
  placeholders: number;
  orphans: number;
}> {
  const db = await getDatabase();
  let placeholders = 0;
  let orphans = 0;

  // 1. 删除占位联系人（创建目录时自动生成的"（待添加）"）
  const phResult = await db.runAsync(
    `DELETE FROM contacts WHERE name = '（待添加）' AND mobile_phones = ''`,
  );
  placeholders = phResult.changes;

  // 2. 删除多余数据：其 level1_dir 下已无真实联系人的孤立行
  //    （目录被删除但占位联系人未清干净的情况）
  const orphanResult = await db.runAsync(
    `DELETE FROM contacts WHERE id IN (
       SELECT id FROM contacts c1
       WHERE c1.level1_dir NOT IN (
         SELECT DISTINCT level1_dir FROM contacts c2
         WHERE c2.address_book_id = c1.address_book_id
           AND c2.name != '（待添加）'
       )
         AND c1.name = '（待添加）'
     )`,
  );
  orphans = orphanResult.changes - placeholders;

  // 3. 删除 address_book_id 指向不存在通讯簿的多余数据
  const bookOrphanResult = await db.runAsync(
    `DELETE FROM contacts WHERE address_book_id NOT IN (SELECT id FROM address_books)`,
  );
  const bookOrphans = bookOrphanResult.changes;

  return { placeholders, orphans: orphans + bookOrphans };
}
