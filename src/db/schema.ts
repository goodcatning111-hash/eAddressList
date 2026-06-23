import * as SQLite from 'expo-sqlite';

/** SQL 建表语句，在数据库首次打开时执行 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS address_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address_book_id INTEGER NOT NULL,
  level1_dir TEXT NOT NULL,
  level2_dir TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT,
  office_phone TEXT,
  mobile_phones TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (address_book_id) REFERENCES address_books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS directory_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address_book_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  parent_dir TEXT NOT NULL DEFAULT '',
  dir_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (address_book_id) REFERENCES address_books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_book ON contacts(address_book_id);
CREATE INDEX IF NOT EXISTS idx_contacts_level1 ON contacts(address_book_id, level1_dir);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_dir_order ON directory_order(address_book_id, level, parent_dir);
`;

/**
 * 在指定数据库实例上执行建表 DDL 和迁移。
 * 幂等（所有语句均使用 IF NOT EXISTS）。
 */
export async function initializeSchema(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  // 迁移：为旧的 address_books 表添加 sort_order 列
  try {
    await db.execAsync(
      `ALTER TABLE address_books ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
    );
  } catch { /* 列已存在 */ }

  // 迁移：address_books 添加 color_index 列（-1 表示使用 id 决定的默认颜色）
  try {
    await db.execAsync(
      `ALTER TABLE address_books ADD COLUMN color_index INTEGER NOT NULL DEFAULT -1`,
    );
  } catch { /* 列已存在 */ }

  // 迁移：directory_order 添加 color_index 列（-1 表示使用名称哈希决定颜色）
  try {
    await db.execAsync(
      `ALTER TABLE directory_order ADD COLUMN color_index INTEGER NOT NULL DEFAULT -1`,
    );
  } catch { /* 列已存在 */ }

  // 迁移：contacts 添加 color_index 列（-1 表示使用姓名首字符决定头像颜色）
  try {
    await db.execAsync(
      `ALTER TABLE contacts ADD COLUMN color_index INTEGER NOT NULL DEFAULT -1`,
    );
  } catch { /* 列已存在 */ }

  // 迁移：contacts 添加 is_favorite 列（0=未收藏, 1=已收藏）
  try {
    await db.execAsync(
      `ALTER TABLE contacts ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`,
    );
  } catch { /* 列已存在 */ }
}
