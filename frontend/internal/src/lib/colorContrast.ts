function rgb(value: string): number[] | undefined {
  let hex = value.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return undefined
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
}
function luminance(color: number[]): number {
  const linear = color.map(c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
function hex(color: number[]): string { return '#' + color.map(c => c.toString(16).padStart(2, '0')).join('') }
export function labelColorPreview(value: string, background: string, fallbackBackground: string) {
  const parsed = rgb(value)
  const fg = parsed ?? [122, 35, 49]
  const bg = rgb(background) ?? rgb(fallbackBackground)!
  const a = luminance(fg), b = luminance(bg)
  return { foreground: hex(fg), background: hex(bg), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), valid: !value.trim() || !!parsed }
}
