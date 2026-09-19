export type Notation = 'Indian' | 'US'

interface Scaled {
  value: number
  label: string
  yTitle: string
}

// Matches Python auto_scale exactly — Cr is the max unit for Indian notation
export const DIVISORS: Record<string, number> = {
  '': 1, K: 1e3, L: 1e5, Cr: 1e7, M: 1e6, B: 1e9,
}

export function autoScale(raw: number, notation: Notation): Scaled {
  const abs = Math.abs(raw)
  if (notation === 'Indian') {
    if (abs >= 1e7) return { value: raw / 1e7, label: 'Cr', yTitle: 'Crores' }
    if (abs >= 1e5) return { value: raw / 1e5, label: 'L',  yTitle: 'Lakhs' }
    if (abs >= 1e3) return { value: raw / 1e3, label: 'K',  yTitle: 'Thousands' }
    return { value: raw, label: '', yTitle: '' }
  } else {
    if (abs >= 1e9) return { value: raw / 1e9, label: 'B', yTitle: 'Billions' }
    if (abs >= 1e6) return { value: raw / 1e6, label: 'M', yTitle: 'Millions' }
    if (abs >= 1e3) return { value: raw / 1e3, label: 'K', yTitle: 'Thousands' }
    return { value: raw, label: '', yTitle: '' }
  }
}

export function fmtNum(raw: number, notation: Notation, isCount = false): string {
  const v = isCount ? Math.floor(raw) : raw
  const { value, label } = autoScale(v, notation)
  if (!label) return Math.floor(value).toLocaleString('en-IN')
  return `${value.toFixed(2)} ${label}`
}

export function scaleSeries(
  values: number[],
  notation: Notation,
  isCount = false
): { scaled: number[]; label: string; yTitle: string } {
  const max = Math.max(...values.map(Math.abs), 0)
  const { label, yTitle } = autoScale(max, notation)
  const div = DIVISORS[label] ?? 1
  const scaled = values.map(v => {
    const floored = isCount ? Math.floor(v) : v
    return floored / div
  })
  return { scaled, label, yTitle }
}

export function fmtScaled(val: number, label: string, decimals = 2): string {
  if (!label) return Math.floor(val).toLocaleString('en-IN')
  return `${val.toFixed(decimals)} ${label}`
}

export const MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
export const MONTH_ABBR: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

export function fyLabel(fy: number): string {
  return `FY ${fy}-${String(fy + 1).slice(-2)}`
}

export const PCU_WEIGHTS: Record<string, number> = {
  CAR_JEEP: 1.0, LCV: 1.5, BUS_TRUCK: 3.0,
  '3_AXLE': 4.0, '4_6_AXLE': 1.0, OSV: 4.5,
}
