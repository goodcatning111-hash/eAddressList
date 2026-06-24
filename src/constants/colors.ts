/** Morris 柔和色板 */
export const MorrisColors = [
  { name: 'Sand', bg: '#F5E6D3', fg: '#8B6914', darkBg: '#3D362D', darkFg: '#D4B872' },
  { name: 'Sage', bg: '#D4E8D0', fg: '#2D5A27', darkBg: '#2D3A2C', darkFg: '#8CB87A' },
  { name: 'Sky', bg: '#D6E4F0', fg: '#1A4B7A', darkBg: '#1E2F3D', darkFg: '#7AA8CC' },
  { name: 'Mauve', bg: '#E8D5E0', fg: '#6B3A5A', darkBg: '#3D2E37', darkFg: '#C48AAA' },
  { name: 'Apricot', bg: '#F0D8C8', fg: '#8B4513', darkBg: '#3D302A', darkFg: '#CC8B55' },
  { name: 'Moss', bg: '#D5E8D4', fg: '#3D6B35', darkBg: '#2B3528', darkFg: '#7AAA6A' },
  { name: 'Lavender', bg: '#E0D5F0', fg: '#4A2D70', darkBg: '#2E2A3D', darkFg: '#A080CC' },
  { name: 'Rose', bg: '#F0D5D5', fg: '#8B3A3A', darkBg: '#3D2C2C', darkFg: '#CC7070' },
  { name: 'Teal', bg: '#D0E8E8', fg: '#1A6B6B', darkBg: '#253838', darkFg: '#5AAAAA' },
  { name: 'Peach', bg: '#F5E0D0', fg: '#8B5A3A', darkBg: '#3D322A', darkFg: '#CC9966' },
];

/** 根据索引获取色板颜色 */
export function getMorrisColor(index: number) {
  return MorrisColors[index % MorrisColors.length];
}

/** 根据索引 + 主题模式获取颜色（含深色变体） */
export function getMorrisColorForTheme(index: number, isDark: boolean) {
  const c = MorrisColors[index % MorrisColors.length];
  return isDark ? { bg: c.darkBg, fg: c.darkFg } : { bg: c.bg, fg: c.fg };
}

/** 根据姓名确定性地返回头像颜色 */
export function getNameColor(name: string): { bg: string; fg: string } {
  const code = name ? name.charCodeAt(0) : 0;
  return MorrisColors[code % MorrisColors.length];
}

/** 混入白色使颜色变浅（亮色模式用）。amount: 0=不变, 1=纯白 */
export function lightenColor(hex: string, amount = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

/** 深色模式下微调背景形成层次 */
function darkenContactBg(hex: string, amount = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (40 - c) * amount);
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

/** 获取适合当前主题的联系人行背景色 */
export function getContactBg(sectionBg: string, isDark: boolean): string {
  return isDark ? darkenContactBg(sectionBg) : lightenColor(sectionBg);
}

/** 字符串哈希 → 0..N-1 */
export function hashIndex(s: string, max: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % max;
}
