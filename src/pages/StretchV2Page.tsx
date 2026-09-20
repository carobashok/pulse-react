import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useStretch } from '../hooks/useStretch'
import { usePlazaList } from '../hooks/usePlazaList'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { useVehicleCategories } from '../hooks/useVehicleCategories'
import { PageHeader, EmptyState, SectionCard, ChartTooltip } from '../components/UI'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
  { value: 36, label: 'Last 36 months' },
  { value: 60, label: 'Last 5 years'   },
  { value: 0,  label: 'All time'       },
]

const PLAZA_COLORS = ['#e07b10', '#3d7ab5', '#16a085', '#9b59b6', '#c94f4f']

function fmtMonth(d: string) {
  const dt = new Date(d)
  return `${dt.toLocaleString('en', { month: 'short' })}-${dt.getFullYear()}`
}

function fmtNum(v: number) {
  return v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0)
}

function fmtPct(v: number | null) {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function pctColor(v: number | null) {
  if (v === null) return '#b0bac8'
  return v >= 0 ? '#16a085' : '#c94f4f'
}

// ─── Plaza multi-select ───────────────────────────────────────────────────────

function PlazaSelector({ selected, onChange, allPlazas }: {
  selected: string[]
  onChange: (p: string[]) => void
  allPlazas: string[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = allPlazas.filter(p => p.toLowerCase().includes(q.toLowerCase()) && !selected.includes(p))

  function toggle(p: string) {
    onChange(selected.includes(p) ? selected.filter(s => s !== p) : [...selected, p])
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: '2 1 320px' }}>
      <label style={lblStyle}>Select Plazas to Compare</label>
      <div onClick={() => setOpen(o => !o)} style={{
        background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4,
        padding: '5px 10px', cursor: 'pointer', minHeight: 34,
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
      }}>
        {selected.length === 0 && <span style={{ color: '#b0bac8', fontSize: 12 }}>Select plazas to compare…</span>}
        {selected.map((p, i) => (
          <span key={p} style={{
            background: PLAZA_COLORS[i % PLAZA_COLORS.length], color: '#fff',
            borderRadius: 3, padding: '1px 6px', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {p}
            <span onClick={e => { e.stopPropagation(); toggle(p) }} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
          </span>
        ))}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e2e6ed', borderRadius: 4,
          boxShadow: '0 4px 16px #1a254020', maxHeight: 280, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #e2e6ed' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search plaza…"
              style={{ width: '100%', border: '1px solid #dde2ea', borderRadius: 4, padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'DM Sans', background: '#f4f6f9' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(p => (
              <div key={p} onClick={() => { toggle(p); setQ('') }}
                style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: '#1a2540' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f6f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

function TrendChart({ title, chartData, plazas }: {
  title: string
  chartData: Record<string, string | number | null>[]
  plazas: string[]
}) {
  return (
    <SectionCard title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#8995a8', fontSize: 10, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#8995a8', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(+v)} width={55} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#dde2ea' }} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
          {plazas.map((p, i) => (
            <Line key={p} type="monotone" dataKey={p}
              stroke={PLAZA_COLORS[i % PLAZA_COLORS.length]}
              strokeWidth={2} dot={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

// ─── Change table ─────────────────────────────────────────────────────────────

function ChangeTable({ title, rows, plazas }: {
  title: string
  rows: { month: string; values: Record<string, number | null> }[]
  plazas: string[]
}) {
  return (
    <SectionCard title={title} flush>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e6ed' }}>
              <th style={{ ...thS, textAlign: 'left' }}>Month</th>
              {plazas.map((p, i) => (
                <th key={p} style={{ ...thS, color: PLAZA_COLORS[i % PLAZA_COLORS.length] }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.month} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '1px solid #f0f2f5' }}>
                <td style={{ padding: '7px 14px', fontFamily: 'DM Sans', color: '#1a2540', fontWeight: 500 }}>{row.month}</td>
                {plazas.map(p => {
                  const v = row.values[p] ?? null
                  return (
                    <td key={p} style={{ padding: '7px 14px', textAlign: 'right', fontFamily: 'DM Mono', fontWeight: v !== null ? 600 : 400, color: pctColor(v) }}>
                      {fmtPct(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function StretchV2Page() {
  const { plazas: allPlazas }              = usePlazaList()
  const { concessionaires, getSpvs, getPlazas } = useConcessionaires()

  const [selectedPlazas, setSelectedPlazas] = useState<string[]>([])
  const [months,          setMonths]         = useState(24)
  const [activeTab,       setActiveTab]      = useState<'trends' | 'changes'>('trends')
  const [concessionaire,  setConcessionaire] = useState('All')
  const [spv,             setSpv]            = useState('All')
  const [changeCat,       setChangeCat]      = useState<string>('')

  const spvOptions     = getSpvs(concessionaire)
  const filteredPlazas = concessionaire === 'All' && spv === 'All'
    ? allPlazas : getPlazas(concessionaire, spv)

  function handleConcChange(val: string) { setConcessionaire(val); setSpv('All'); setSelectedPlazas([]) }
  function handleSpvChange(val: string)  { setSpv(val); setSelectedPlazas([]) }

  const { data, loading, error } = useStretch(selectedPlazas, months)
  const { mappings, loading: mapLoading, getMinCategories, getMinTemplateMapping, getRawTypesForCategory } = useVehicleCategories(selectedPlazas)

  const allMonths = useMemo(() =>
    [...new Set(data.map(r => r.month_date))].sort(), [data])

  const minCategories    = useMemo(() => getMinCategories(),    [mappings, selectedPlazas])
  const minTemplateMap   = useMemo(() => getMinTemplateMapping(),[mappings, selectedPlazas])

  // Set default change category when categories load
  useEffect(() => {
    if (minCategories.length > 0 && !changeCat) {
      setChangeCat(minCategories[0].display_category)
    }
  }, [minCategories])

  // ── Build ADPCU chart (total across all vehicle types) ──
  const adpcuChart = useMemo(() => allMonths.map(m => {
    const entry: Record<string, string | number | null> = { month: fmtMonth(m) }
    for (const plaza of selectedPlazas) {
      const rows = data.filter(r => r.plaza_name === plaza && r.month_date === m)
      const totalPCU = rows.reduce((s, r) => s + r.total_pcu, 0)
      const days = rows[0]?.days_in_month ?? 30
      entry[plaza] = days > 0 ? +(totalPCU / days).toFixed(1) : null
    }
    return entry
  }), [data, allMonths, selectedPlazas])

  // ── Build chart per display category ──
  function buildCategoryChart(displayCategory: string) {
    return allMonths.map(m => {
      const entry: Record<string, string | number | null> = { month: fmtMonth(m) }
      for (const plaza of selectedPlazas) {
        const rawTypes = getRawTypesForCategory(plaza, displayCategory, minTemplateMap)
        if (!rawTypes.length) { entry[plaza] = null; continue }
        const rows = data.filter(r => r.plaza_name === plaza && r.month_date === m && rawTypes.includes(r.vehicle_type))
        if (!rows.length) { entry[plaza] = null; continue }
        const totalCount = rows.reduce((s, r) => s + r.total_count, 0)
        const days = rows[0]?.days_in_month ?? 30
        entry[plaza] = days > 0 ? Math.round(totalCount / days) : null
      }
      return entry
    })
  }

  // ── MoM change ──
  const momRows = useMemo(() => {
    if (!changeCat) return []
    return allMonths.slice(1).reverse().map((m, idx) => {
      const prevM = allMonths[allMonths.length - 2 - idx]
      const values: Record<string, number | null> = {}
      for (const plaza of selectedPlazas) {
        const rawTypes = getRawTypesForCategory(plaza, changeCat, minTemplateMap)
        const getVal = (month: string) => {
          const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month && rawTypes.includes(r.vehicle_type))
          if (!rows.length) return null
          const total = rows.reduce((s, r) => s + r.total_count, 0)
          const days = rows[0]?.days_in_month ?? 30
          return days > 0 ? total / days : null
        }
        const curr = getVal(m); const prev = getVal(prevM)
        values[plaza] = curr !== null && prev !== null && prev > 0 ? +((curr / prev - 1) * 100).toFixed(1) : null
      }
      return { month: fmtMonth(m), values }
    })
  }, [data, allMonths, selectedPlazas, changeCat, mappings, minCategories])

  // ── YoY change ──
  const yoyRows = useMemo(() => {
    if (!changeCat) return []
    const yoyMonths = allMonths.filter(m => {
      const d = new Date(m); d.setFullYear(d.getFullYear() - 1)
      return allMonths.includes(d.toISOString().slice(0, 7) + '-01')
    }).reverse()
    return yoyMonths.map(m => {
      const d = new Date(m); d.setFullYear(d.getFullYear() - 1)
      const priorM = d.toISOString().slice(0, 7) + '-01'
      const values: Record<string, number | null> = {}
      for (const plaza of selectedPlazas) {
        const rawTypes = getRawTypesForCategory(plaza, changeCat, minTemplateMap)
        const getVal = (month: string) => {
          const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month && rawTypes.includes(r.vehicle_type))
          if (!rows.length) return null
          const total = rows.reduce((s, r) => s + r.total_count, 0)
          const days = rows[0]?.days_in_month ?? 30
          return days > 0 ? total / days : null
        }
        const curr = getVal(m); const prior = getVal(priorM)
        values[plaza] = curr !== null && prior !== null && prior > 0 ? +((curr / prior - 1) * 100).toFixed(1) : null
      }
      return { month: `${fmtMonth(m)} vs ${fmtMonth(priorM)}`, values }
    })
  }, [data, allMonths, selectedPlazas, changeCat, mappings, minCategories])

  const isLoading = loading || mapLoading

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader
        title="Stretch Analysis V2"
        subtitle="Category-aware plaza comparison · Vehicle grouping per concession agreement"
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'flex-end' }}>
        <div style={filterWrap}>
          <label style={lblStyle}>Concessionaire</label>
          <select value={concessionaire} onChange={e => handleConcChange(e.target.value)} style={selStyle}>
            <option value="All">All Concessionaires</option>
            {concessionaires.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={filterWrap}>
          <label style={lblStyle}>SPV / Project</label>
          <select value={spv} onChange={e => handleSpvChange(e.target.value)} style={selStyle}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <PlazaSelector selected={selectedPlazas} onChange={setSelectedPlazas} allPlazas={filteredPlazas} />
        <div style={filterWrap}>
          <label style={lblStyle}>Show Last</label>
          <select value={months} onChange={e => setMonths(+e.target.value)} style={selStyle}>
            {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {selectedPlazas.length === 0 && <EmptyState message="Select at least one plaza to begin analysis" />}
      {selectedPlazas.length > 0 && isLoading && <EmptyState message="Loading data…" />}
      {selectedPlazas.length > 0 && error && <EmptyState message={`Error: ${error}`} />}

      {selectedPlazas.length > 0 && !isLoading && !error && (
        <>
          {/* Category info */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {selectedPlazas.map((p, i) => {
                const cats = [...new Set((mappings[p] ?? []).map(m => m.display_category))]
                return (
                  <div key={p} style={{ fontSize: 11, background: '#fff', border: `1px solid ${PLAZA_COLORS[i % PLAZA_COLORS.length]}30`, borderRadius: 4, padding: '5px 10px' }}>
                    <span style={{ color: PLAZA_COLORS[i % PLAZA_COLORS.length], fontWeight: 600 }}>{p}</span>
                    <span style={{ color: '#8995a8', marginLeft: 8 }}>{cats.join(' · ')}</span>
                  </div>
                )
              })}
            </div>
            {minCategories.length > 0 && (
              <div style={{ fontSize: 11, color: '#8995a8', background: '#f8f9fb', border: '1px solid #e2e6ed', borderRadius: 4, padding: '5px 12px', display: 'inline-block' }}>
                📊 Comparing on: <strong style={{ color: '#1a2540' }}>{minCategories.map(c => c.display_category).join(' · ')}</strong>
                <span style={{ marginLeft: 8, color: '#b0bac8' }}>— based on most grouped template</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e2e6ed' }}>
            {([['trends', 'Traffic Trends'], ['changes', 'MoM & YoY Changes']] as [string, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id as 'trends' | 'changes')} style={{
                padding: '9px 20px', fontSize: 12, fontWeight: activeTab === id ? 600 : 400,
                color: activeTab === id ? '#1a2540' : '#8995a8',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === id ? '2px solid #e07b10' : '2px solid transparent',
                marginBottom: -2, fontFamily: 'DM Sans',
              }}>{label}</button>
            ))}
          </div>

          {/* Tab 1 — Traffic Trends */}
          {activeTab === 'trends' && (
            <>
              {/* Total ADPCU */}
              <TrendChart title="Total ADPCU — Avg Daily PCU" chartData={adpcuChart} plazas={selectedPlazas} />

              {/* Per category — based on minimum (most grouped) template */}
              {minCategories.map(cat => (
                <TrendChart
                  key={cat.display_category}
                  title={`${cat.display_category} — Avg Daily Traffic`}
                  chartData={buildCategoryChart(cat.display_category)}
                  plazas={selectedPlazas}
                />
              ))}
            </>
          )}

          {/* Tab 2 — MoM & YoY */}
          {activeTab === 'changes' && (
            <>
              {/* Category selector */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                {minCategories.map(cat => (
                  <button key={cat.display_category}
                    onClick={() => setChangeCat(cat.display_category)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontFamily: 'DM Sans',
                      background: changeCat === cat.display_category ? '#1a2540' : '#fff',
                      color: changeCat === cat.display_category ? '#fff' : '#8995a8',
                      border: '1px solid #dde2ea', borderRadius: 4,
                      cursor: 'pointer', fontWeight: changeCat === cat.display_category ? 600 : 400,
                    }}>{cat.display_category}</button>
                ))}
              </div>

              <ChangeTable title="Month-on-Month % Change" rows={momRows} plazas={selectedPlazas} />
              <ChangeTable title="Year-on-Year % Change (same month prior year)" rows={yoyRows} plazas={selectedPlazas} />
            </>
          )}
        </>
      )}
    </div>
  )
}

const lblStyle:   React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }
const filterWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 160 }
const selStyle:   React.CSSProperties = {
  background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4,
  color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12,
  fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
}
const thS: React.CSSProperties = {
  padding: '9px 14px', textAlign: 'right', fontWeight: 600,
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', background: '#f8f9fb', fontFamily: 'DM Sans',
  borderBottom: '1px solid #e2e6ed', color: '#a0aabc',
}
