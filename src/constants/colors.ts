/** Morris 柔和色板 — 用于通讯簿卡片和目录卡片的配色 */
export const MorrisColors = [
  { name: 'Sand', bg: '#F5E6D3', fg: '#8B6914' },
  { name: 'Sage', bg: '#D4E8D0', fg: '#2D5A27' },
  { name: 'Sky', bg: '#D6E4F0', fg: '#1A4B7A' },
  { name: 'Mauve', bg: '#E8D5E0', fg: '#6B3A5A' },
  { name: 'Apricot', bg: '#F0D8C8', fg: '#8B4513' },
  { name: 'Moss', bg: '#D5E8D4', fg: '#3D6B35' },
  { name: 'Lavender', bg: '#E0D5F0', fg: '#4A2D70' },
  { name: 'Rose', bg: '#F0D5D5', fg: '#8B3A3A' },
  { name: 'Teal', bg: '#D0E8E8', fg: '#1A6B6B' },
  { name: 'Peach', bg: '#F5E0D0', fg: '#8B5A3A' },
];

/** 根据索引获取循环色板颜色 */
export function getMorrisColor(index: number) {
  return MorrisColors[index % MorrisColors.length];
}

/** 根据姓名确定性地返回头像颜色 */
export function getNameColor(name: string): { bg: string; fg: string } {
  const code = name ? name.charCodeAt(0) : 0;
  return MorrisColors[code % MorrisColors.length];
}

/** 字符串哈希 → 0..N-1 */
export function hashIndex(s: string, max: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % max;
}
