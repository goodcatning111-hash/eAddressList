import * as FileSystem from 'expo-file-system/legacy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveSlotMeta {
  /** Slot index 0–5 */
  index: number;
  /** ISO timestamp of when this save was created */
  savedAt: string;
  /** Human-readable summary (e.g. "3 本通讯簿 · 42 人") */
  summary: string;
  /** Whether this slot has a save file */
  hasData: boolean;
}

/** Full database snapshot stored per slot */
export interface SaveData {
  version: number;
  savedAt: string;
  addressBooks: any[];
  contacts: any[];
  directoryOrder: any[];
}

const SAVE_DIR = `${FileSystem.documentDirectory}saves/`;
const SAVE_VERSION = 1;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slotPath(index: number): string {
  return `${SAVE_DIR}slot_${index}.json`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SAVE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVE_DIR, { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get metadata for all 6 slots. */
export async function getAllSlots(): Promise<SaveSlotMeta[]> {
  await ensureDir();
  const slots: SaveSlotMeta[] = [];
  for (let i = 0; i < 6; i++) {
    const path = slotPath(i);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      try {
        const json = await FileSystem.readAsStringAsync(path);
        const data: SaveData = JSON.parse(json);
        slots.push({
          index: i,
          savedAt: data.savedAt,
          summary: `${data.addressBooks?.length ?? 0} 本通讯簿 · ${data.contacts?.length ?? 0} 条记录`,
          hasData: true,
        });
      } catch {
        slots.push({ index: i, savedAt: '', summary: '', hasData: false });
      }
    } else {
      slots.push({ index: i, savedAt: '', summary: '', hasData: false });
    }
  }
  return slots;
}

/** Write save data to a slot (overwrites if exists). */
export async function saveSlot(index: number, data: SaveData): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(slotPath(index), JSON.stringify(data));
}

/** Read save data from a slot. Throws if empty or corrupt. */
export async function loadSlot(index: number): Promise<SaveData> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(slotPath(index));
  if (!info.exists) throw new Error('存档位为空');
  const json = await FileSystem.readAsStringAsync(slotPath(index));
  return JSON.parse(json) as SaveData;
}

/** Delete a slot. */
export async function deleteSlot(index: number): Promise<void> {
  await ensureDir();
  const info = await FileSystem.getInfoAsync(slotPath(index));
  if (info.exists) {
    await FileSystem.deleteAsync(slotPath(index), { idempotent: true });
  }
}
