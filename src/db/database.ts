import * as SQLite from 'expo-sqlite';
import { initializeSchema } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/** 获取（或初始化）数据库单例，同时执行建表 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('eaddresslist.db');
    await initializeSchema(db);
  }
  return db;
}

/** 仅供测试/调试：关闭并重置数据库连接 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
