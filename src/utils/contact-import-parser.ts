import type { ContactFormData } from '@/db/types';

export type ImportField =
  | 'level1'
  | 'level2'
  | 'name'
  | 'position'
  | 'officePhone'
  | 'mobilePhones';

export interface CellRange {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

export interface ParsedContactRows {
  contacts: ContactFormData[];
  headerRowIndex: number | null;
  columnMap: Record<ImportField, number | undefined>;
  skippedRows: number;
}

const FIELD_ORDER: ImportField[] = [
  'level1',
  'level2',
  'name',
  'position',
  'officePhone',
  'mobilePhones',
];

const HEADER_ALIASES: Record<ImportField, string[]> = {
  level1: [
    '一级目录', '一级部门', '一级机构', '一级组织', '一级单位',
    '上级部门', '大部门', '部门', '组织', '单位',
    'level1', 'level1dir', 'firstlevel',
  ],
  level2: [
    '二级目录', '二级部门', '二级机构', '二级组织', '二级单位',
    '科室', '处室', '分部', '小组', '组别',
    'level2', 'level2dir', 'secondlevel',
  ],
  name: [
    '姓名', '人员姓名', '员工姓名', '联系人姓名', '联系人', '名字',
    'name', 'fullname',
  ],
  position: [
    '职务', '职位', '岗位', '岗位名称', '职称',
    'position', 'jobtitle', 'title',
  ],
  officePhone: [
    '办公电话', '办公号码', '办公室电话', '座机', '固定电话', '内线',
    'officephone', 'workphone', 'landline',
  ],
  mobilePhones: [
    '手机号', '手机号码', '移动电话', '移动号码', '联系电话', '电话', '手机', '号码',
    'mobile', 'mobilephone', 'cellphone', 'phone',
  ],
};

const POSITIONAL_COLUMN_MAP: Record<ImportField, number> = {
  level1: 0,
  level2: 1,
  name: 2,
  position: 3,
  officePhone: 4,
  mobilePhones: 5,
};

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeHeader(value: unknown): string {
  return cellText(value)
    .toLowerCase()
    .replace(/[\s　_\-—:：()（）[\]【】.。/\\]+/g, '');
}

function headerScore(header: string, alias: string, aliasIndex: number): number {
  if (!header) return 0;
  const normalizedAlias = normalizeHeader(alias);
  if (header === normalizedAlias) return 1000 - aliasIndex;

  // 允许“办公电话（含区号）”一类带注释的表头，但短词只做精确匹配，
  // 避免“电话”抢占“办公电话”列。
  if (normalizedAlias.length >= 3 && header.includes(normalizedAlias)) {
    return 500 + normalizedAlias.length - aliasIndex / 100;
  }
  return 0;
}

interface HeaderMappingCandidate {
  field: ImportField;
  column: number;
  score: number;
}

function mapHeaderRow(row: readonly unknown[]): {
  columnMap: Record<ImportField, number | undefined>;
  totalScore: number;
  fieldCount: number;
} {
  const candidates: HeaderMappingCandidate[] = [];

  row.forEach((cell, column) => {
    const header = normalizeHeader(cell);
    if (!header) return;

    for (const field of FIELD_ORDER) {
      HEADER_ALIASES[field].forEach((alias, aliasIndex) => {
        const score = headerScore(header, alias, aliasIndex);
        if (score > 0) candidates.push({ field, column, score });
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const columnMap = {} as Record<ImportField, number | undefined>;
  const assignedFields = new Set<ImportField>();
  const assignedColumns = new Set<number>();
  let totalScore = 0;

  for (const candidate of candidates) {
    if (assignedFields.has(candidate.field) || assignedColumns.has(candidate.column)) continue;
    columnMap[candidate.field] = candidate.column;
    assignedFields.add(candidate.field);
    assignedColumns.add(candidate.column);
    totalScore += candidate.score;
  }

  return { columnMap, totalScore, fieldCount: assignedFields.size };
}

function findHeaderRow(rows: readonly (readonly unknown[])[]): {
  index: number;
  columnMap: Record<ImportField, number | undefined>;
} | null {
  let best: {
    index: number;
    columnMap: Record<ImportField, number | undefined>;
    totalScore: number;
    fieldCount: number;
  } | null = null;

  const scanLimit = Math.min(rows.length, 30);
  for (let index = 0; index < scanLimit; index++) {
    const mapping = mapHeaderRow(rows[index] ?? []);
    if (mapping.columnMap.name == null || mapping.fieldCount < 2) continue;

    if (
      best == null
      || mapping.fieldCount > best.fieldCount
      || (mapping.fieldCount === best.fieldCount && mapping.totalScore > best.totalScore)
    ) {
      best = { index, ...mapping };
    }
  }

  return best ? { index: best.index, columnMap: best.columnMap } : null;
}

function expandMergedCells(
  rows: readonly (readonly unknown[])[],
  merges: readonly CellRange[],
): unknown[][] {
  const expanded = rows.map((row) => [...row]);

  for (const merge of merges) {
    const value = expanded[merge.s.r]?.[merge.s.c];
    if (cellText(value) === '') continue;

    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex++) {
      if (!expanded[rowIndex]) expanded[rowIndex] = [];
      for (let column = merge.s.c; column <= merge.e.c; column++) {
        expanded[rowIndex][column] = value;
      }
    }
  }

  return expanded;
}

function getCell(
  row: readonly unknown[],
  columnMap: Record<ImportField, number | undefined>,
  field: ImportField,
): string {
  const column = columnMap[field];
  return column == null ? '' : cellText(row[column]);
}

function normalizeName(value: string): string {
  return value.replace(/[\s　]+/g, ' ').trim();
}

function normalizePosition(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/[\s　]+/g, ' ').trim();
}

function splitMobilePhones(value: string): string[] {
  return value
    .split(/[,，;；\r\n]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

/**
 * 将工作表二维数据解析为联系人。
 *
 * - 有表头时按整行表头映射，不依赖第一条数据是否有空单元格。
 * - 无可识别表头时才固定按 A-F 列解析，空列不会造成后续字段前移。
 * - Excel 合并单元格会先展开，保证合并区域内每条联系人保留目录层级。
 */
export function parseContactRows(
  sourceRows: readonly (readonly unknown[])[],
  merges: readonly CellRange[] = [],
): ParsedContactRows {
  const rows = expandMergedCells(sourceRows, merges);
  const detectedHeader = findHeaderRow(rows);
  const columnMap: Record<ImportField, number | undefined> = detectedHeader
    ? detectedHeader.columnMap
    : { ...POSITIONAL_COLUMN_MAP };
  const startIndex = detectedHeader ? detectedHeader.index + 1 : 0;
  const contacts: ContactFormData[] = [];
  let skippedRows = 0;

  for (let index = startIndex; index < rows.length; index++) {
    const row = rows[index] ?? [];
    const name = normalizeName(getCell(row, columnMap, 'name'));
    if (!name) {
      skippedRows++;
      continue;
    }

    contacts.push({
      level1Dir: getCell(row, columnMap, 'level1') || '未分类',
      level2Dir: getCell(row, columnMap, 'level2'),
      name,
      position: normalizePosition(getCell(row, columnMap, 'position')),
      officePhone: getCell(row, columnMap, 'officePhone'),
      mobilePhones: splitMobilePhones(getCell(row, columnMap, 'mobilePhones')),
    });
  }

  return {
    contacts,
    headerRowIndex: detectedHeader?.index ?? null,
    columnMap,
    skippedRows,
  };
}
