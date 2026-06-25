/**
 * Morris 柔和色板 — 深色模式卡片：比浅色稍暗的同系莫兰迪色
 * 保持粉彩柔和感，但略深一层，在暗背景上安定不刺眼
 */
export const MorrisColors = [
  { name: 'Sand',    bg: '#F5E6D3', fg: '#8B6914', darkBg: '#D8C8B4', darkFg: '#6E5010' },
  { name: 'Sage',    bg: '#D4E8D0', fg: '#2D5A27', darkBg: '#B5CAB0', darkFg: '#1E401A' },
  { name: 'Sky',     bg: '#D6E4F0', fg: '#1A4B7A', darkBg: '#B6C6D4', darkFg: '#103660' },
  { name: 'Mauve',   bg: '#E8D5E0', fg: '#6B3A5A', darkBg: '#C8B5C2', darkFg: '#502A44' },
  { name: 'Apricot', bg: '#F0D8C8', fg: '#8B4513', darkBg: '#D2BAA8', darkFg: '#6E300A' },
  { name: 'Moss',    bg: '#D5E8D4', fg: '#3D6B35', darkBg: '#B5C8B4', darkFg: '#2C5026' },
  { name: 'Lavender',bg: '#E0D5F0', fg: '#4A2D70', darkBg: '#C2B5D2', darkFg: '#342058' },
  { name: 'Rose',    bg: '#F0D5D5', fg: '#8B3A3A', darkBg: '#D2B5B5', darkFg: '#6E2828' },
  { name: 'Teal',    bg: '#D0E8E8', fg: '#1A6B6B', darkBg: '#B0C8C8', darkFg: '#105050' },
  { name: 'Peach',   bg: '#F5E0D0', fg: '#8B5A3A', darkBg: '#D5C0B0', darkFg: '#6E4028' },
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

/** 深色模式下微调背景形成层次（明亮卡片只需轻微暗化） */
function darkenContactBg(hex: string, amount = 0.12): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (c * 0.75 - c) * amount);
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
