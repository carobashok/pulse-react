import React from 'react'
import type { Notation } from '../lib/formatters'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid #e2e6ed' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a2540', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ color: '#8995a8', fontSize: 12, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>}
    </div>
  )
}

export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'flex-end' }}>
      {children}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, width = 180 }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; width?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: width }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function KPIStrip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, background: '#e2e6ed', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
      {children}
    </div>
  )
}

export function KPICard({ label, value, unit, delta, accent = false }: { label: string; value: string; unit?: string; delta?: number; accent?: boolean }) {
  return (
    <div style={{ background: '#fff', padding: '14px 16px', borderTop: accent ? '3px solid #e07b10' : '3px solid transparent' }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#a0aabc', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      <div style={{ fontFamily: 'DM Mono', fontSize: 19, fontWeight: 500, color: accent ? '#e07b10' : '#1a2540', lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 10, color: '#a0aabc', marginLeft: 4 }}>{unit}</span>}
      </div>
      {delta !== undefined && (
        <div style={{ fontSize: 10, color: delta >= 0 ? '#16a085' : '#c94f4f', marginTop: 5, fontFamily: 'DM Mono' }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% YoY
        </div>
      )}
    </div>
  )
}

export function SectionCard({ title, subtitle, children, flush = false }: { title?: string; subtitle?: string; children: React.ReactNode; flush?: boolean }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, marginBottom: 14, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #e2e6ed', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2540' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: '#a0aabc' }}>{subtitle}</span>}
        </div>
      )}
      <div style={{ padding: flush ? 0 : '16px 18px' }}>{children}</div>
    </div>
  )
}

export function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, padding: '10px 14px', fontSize: 12, fontFamily: 'DM Mono', boxShadow: '0 4px 16px #1a254015' }}>
      <div style={{ fontFamily: 'DM Sans', fontWeight: 600, color: '#8995a8', marginBottom: 8, fontSize: 11 }}>{label}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 3, display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: '#8995a8', fontFamily: 'DM Sans' }}>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{typeof p.value === 'number' ? `${p.value.toFixed(2)}${unit ? ' ' + unit : ''}` : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: '40px 24px', textAlign: 'center', color: '#b0bac8', fontSize: 12 }}>{message}</div>
}

export function NotationToggle({ value, onChange }: { value: Notation; onChange: (v: Notation) => void }) {
  return (
    <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
      {(['Indian', 'US'] as Notation[]).map(n => (
        <button key={n} onClick={() => onChange(n)} style={{ padding: '5px 12px', background: value === n ? '#1a2540' : '#fff', color: value === n ? '#fff' : '#8995a8', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 11, fontWeight: value === n ? 600 : 400 }}>
          {n === 'Indian' ? 'L / Cr' : 'K / M / B'}
        </button>
      ))}
    </div>
  )
}

export function DataTable({ cols, rows, colorFn }: { cols: { key: string; label: string; align?: 'left' | 'right'; mono?: boolean }[]; rows: Record<string, React.ReactNode>[]; colorFn?: (key: string, val: React.ReactNode) => string | undefined }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e6ed' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '9px 14px', textAlign: c.align ?? 'right', color: '#a0aabc', fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#f8f9fb' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f2f5' }}>
              {cols.map(c => {
                const val = row[c.key]
                const color = colorFn?.(c.key, val)
                return <td key={c.key} style={{ padding: '8px 14px', textAlign: c.align ?? 'right', fontFamily: c.mono !== false ? 'DM Mono' : 'DM Sans', color: color ?? '#1a2540', fontWeight: color ? 600 : 400, whiteSpace: 'nowrap' }}>{val ?? '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
