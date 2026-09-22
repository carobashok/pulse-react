import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useStretch } from '../hooks/useStretch'
import { usePlazaList } from '../hooks/usePlazaList'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { useVehicleCategories } from '../hooks/useVehicleCategories'
import { usePlazaMaster } from '../hooks/usePlazaMaster'
import { PageHeader, EmptyState, SectionCard, ChartTooltip } from '../components/UI'
import PlazaMap from '../components/PlazaMap'

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

// ─── Grid table — Plaza × FY rows, month columns ─────────────────────────────

const MONTH_COLS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const MONTH_COL_MAP: Record<string, number> = {
  Apr:1, May:2, Jun:3, Jul:4, Aug:5, Sep:6,
  Oct:7, Nov:8, Dec:9, Jan:10, Feb:11, Mar:12,
}
// Maps calendar month number (1-12) to index in MONTH_COLS
const MONTH_ORDER_IDX: Record<number, number> = {
  4:0, 5:1, 6:2, 7:3, 8:4, 9:5, 10:6, 11:7, 12:8, 1:9, 2:10, 3:11
}

function GridTable({ title, plazaFYData, plazas }: {
  title: string
  // plazaFYData[plaza][fy][monthAbbr] = pct | null
  plazaFYData: Record<string, Record<string, Record<string, number | null>>>
  plazas: string[]
}) {
  const allFYs = [...new Set(
    plazas.flatMap(p => Object.keys(plazaFYData[p] ?? {}))
  )].sort()

  return (
    <div style={{ marginBottom: 24, background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e6ed', fontSize: 12, fontWeight: 600, color: '#1a2540' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
              <th style={{ ...gthS, textAlign: 'left', minWidth: 140 }}>Plaza</th>
              <th style={{ ...gthS, textAlign: 'left', width: 60 }}>FY</th>
              {MONTH_COLS.map(m => <th key={m} style={gthS}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {plazas.map((plaza, pi) => {
              const fyMap = plazaFYData[plaza] ?? {}
              const fys   = Object.keys(fyMap).sort().reverse()
              return fys.map((fy, fi) => (
                <tr key={`${plaza}-${fy}`} style={{
                  background: pi % 2 === 0 ? '#fff' : '#fafbfc',
                  borderBottom: fi === fys.length - 1 ? '2px solid #e2e6ed' : '1px solid #f0f2f5',
                }}>
                  {/* Plaza name — only on first FY row */}
                  {fi === 0 ? (
                    <td rowSpan={fys.length} style={{
                      padding: '7px 14px', fontWeight: 600,
                      color: PLAZA_COLORS[pi % PLAZA_COLORS.length],
                      verticalAlign: 'top', borderRight: '1px solid #e2e6ed',
                      background: pi % 2 === 0 ? '#fff' : '#fafbfc',
                    }}>{plaza}</td>
                  ) : null}
                  {/* FY */}
                  <td style={{ padding: '6px 10px', color: '#8995a8', fontFamily: 'DM Sans', fontSize: 11, borderRight: '1px solid #f0f2f5' }}>
                    {fy.replace('FY ', '')}
                  </td>
                  {/* Month cells */}
                  {MONTH_COLS.map(m => {
                    const v = fyMap[fy]?.[m] ?? null
                    return (
                      <td key={m} style={{
                        padding: '6px 8px', textAlign: 'right',
                        fontFamily: 'DM Mono', fontSize: 11,
                        color: v === null ? '#d0d5dd' : v >= 0 ? '#16a085' : '#c94f4f',
                        fontWeight: v !== null ? 600 : 400,
                      }}>
                        {v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                      </td>
                    )
                  })}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const gthS: React.CSSProperties = {
  padding: '8px 8px', textAlign: 'right',
  color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', fontFamily: 'DM Sans',
  borderBottom: '1px solid #e2e6ed',
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
  const [changeCat,       setChangeCat]      = useState<string>('ADPCU')
  const [changeView,      setChangeView]     = useState<'chronological' | 'grid'>('chronological')
  const [showMap,         setShowMap]        = useState(false)
  const [categoryMode,    setCategoryMode]   = useState<'raw' | 'grouped'>('grouped')

  // Raw categories — always all 6, same as Stretch V1
  const RAW_CATEGORIES = [
    { display_category: 'Car / Jeep',  vehicle_types: ['CAR_JEEP'],              display_order: 1 },
    { display_category: 'LCV',         vehicle_types: ['LCV'],                    display_order: 2 },
    { display_category: 'Bus / Truck', vehicle_types: ['BUS_TRUCK'],             display_order: 3 },
    { display_category: '3-Axle',      vehicle_types: ['3_AXLE'],                display_order: 4 },
    { display_category: '4-6 Axle',    vehicle_types: ['4_6_AXLE'],             display_order: 5 },
    { display_category: 'OSV',         vehicle_types: ['OSV'],                   display_order: 6 },
  ]

  const { data: plazaMaster } = usePlazaMaster()

  const spvOptions     = getSpvs(concessionaire)
  const filteredPlazas = concessionaire === 'All' && spv === 'All'
    ? allPlazas : getPlazas(concessionaire, spv)

  function handleConcChange(val: string) { setConcessionaire(val); setSpv('All'); setSelectedPlazas([]) }
  function handleSpvChange(val: string)  { setSpv(val); setSelectedPlazas([]) }

  const { data, loading, error } = useStretch(selectedPlazas, months)
  const { mappings, loading: mapLoading, getMinCategories, getMinTemplateMapping, getRawTypesForCategory } = useVehicleCategories(selectedPlazas)

  const allMonths = useMemo(() =>
    [...new Set(data.map(r => r.month_date))].sort(), [data])

  const minCategories    = useMemo(() => getMinCategories(),     [mappings, selectedPlazas])
  const minTemplateMap   = useMemo(() => getMinTemplateMapping(), [mappings, selectedPlazas])

  // Active categories depend on mode
  const activeCategories = useMemo(() =>
    categoryMode === 'raw'
      ? RAW_CATEGORIES.map(c => ({ display_category: c.display_category, display_order: c.display_order }))
      : minCategories,
    [categoryMode, minCategories]
  )

  useEffect(() => {
    setChangeCat('ADPCU')
  }, [categoryMode])

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

  function buildCategoryChart(displayCategory: string) {
    return allMonths.map(m => {
      const entry: Record<string, string | number | null> = { month: fmtMonth(m) }
      for (const plaza of selectedPlazas) {
        // Raw mode: use fixed vehicle types per category
        // Grouped mode: use template mapping
        const rawTypes = categoryMode === 'raw'
          ? (RAW_CATEGORIES.find(c => c.display_category === displayCategory)?.vehicle_types ?? [])
          : getRawTypesForCategory(plaza, displayCategory, minTemplateMap)

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
        const getVal = (month: string) => {
          if (changeCat === 'ADPCU') {
            const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month)
            if (!rows.length) return null
            const total = rows.reduce((s, r) => s + r.total_pcu, 0)
            const days = rows[0]?.days_in_month ?? 30
            return days > 0 ? total / days : null
          }
          const rawTypes = categoryMode === 'raw' ? (RAW_CATEGORIES.find(c => c.display_category === changeCat)?.vehicle_types ?? []) : getRawTypesForCategory(plaza, changeCat, minTemplateMap)
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
        const getVal = (month: string) => {
          if (changeCat === 'ADPCU') {
            const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month)
            if (!rows.length) return null
            const total = rows.reduce((s, r) => s + r.total_pcu, 0)
            const days = rows[0]?.days_in_month ?? 30
            return days > 0 ? total / days : null
          }
          const rawTypes = categoryMode === 'raw' ? (RAW_CATEGORIES.find(c => c.display_category === changeCat)?.vehicle_types ?? []) : getRawTypesForCategory(plaza, changeCat, minTemplateMap)
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

  // ── Grid data — Plaza × FY × Month ──
  const momGridData = useMemo(() => {
    if (!changeCat) return {}
    const result: Record<string, Record<string, Record<string, number | null>>> = {}
    for (const plaza of selectedPlazas) {
      result[plaza] = {}
      const plazaMonths = allMonths.filter(m =>
        data.some(r => r.plaza_name === plaza && r.month_date === m)
      ).sort()
      for (const m of plazaMonths) {
        const d = new Date(m)
        const cm = d.getMonth() + 1
        const fy = cm >= 4 ? `FY ${d.getFullYear()}-${String(d.getFullYear()+1).slice(-2)}` : `FY ${d.getFullYear()-1}-${String(d.getFullYear()).slice(-2)}`
        const mAbbr = MONTH_COLS[MONTH_ORDER_IDX[cm] ?? 0]
        if (!result[plaza][fy]) result[plaza][fy] = {}
        const prevIdx = plazaMonths.indexOf(m) - 1
        if (prevIdx < 0) { result[plaza][fy][mAbbr] = null; continue }
        const prevM = plazaMonths[prevIdx]
        const getVal = (month: string) => {
          if (changeCat === 'ADPCU') {
            const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month)
            if (!rows.length) return null
            const total = rows.reduce((s, r) => s + r.total_pcu, 0)
            const days = rows[0]?.days_in_month ?? 30
            return days > 0 ? total / days : null
          }
          const rawTypes = categoryMode === 'raw' ? (RAW_CATEGORIES.find(c => c.display_category === changeCat)?.vehicle_types ?? []) : getRawTypesForCategory(plaza, changeCat, minTemplateMap)
          const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month && rawTypes.includes(r.vehicle_type))
          if (!rows.length) return null
          const total = rows.reduce((s, r) => s + r.total_count, 0)
          const days = rows[0]?.days_in_month ?? 30
          return days > 0 ? total / days : null
        }
        const curr = getVal(m); const prev = getVal(prevM)
        result[plaza][fy][mAbbr] = curr !== null && prev !== null && prev > 0 ? +((curr/prev - 1)*100).toFixed(1) : null
      }
    }
    return result
  }, [data, allMonths, selectedPlazas, changeCat, mappings, minTemplateMap])

  const yoyGridData = useMemo(() => {
    if (!changeCat) return {}
    const result: Record<string, Record<string, Record<string, number | null>>> = {}
    for (const plaza of selectedPlazas) {
      result[plaza] = {}
      const plazaMonths = allMonths.filter(m =>
        data.some(r => r.plaza_name === plaza && r.month_date === m)
      ).sort()
      for (const m of plazaMonths) {
        const d  = new Date(m)
        const cm = d.getMonth() + 1
        const fy = cm >= 4 ? `FY ${d.getFullYear()}-${String(d.getFullYear()+1).slice(-2)}` : `FY ${d.getFullYear()-1}-${String(d.getFullYear()).slice(-2)}`
        const mAbbr = MONTH_COLS[MONTH_ORDER_IDX[cm] ?? 0]
        if (!result[plaza][fy]) result[plaza][fy] = {}
        const pd = new Date(m); pd.setFullYear(pd.getFullYear() - 1)
        const priorM = pd.toISOString().slice(0,7) + '-01'
        if (!plazaMonths.includes(priorM)) { result[plaza][fy][mAbbr] = null; continue }
        const getVal = (month: string) => {
          if (changeCat === 'ADPCU') {
            const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month)
            if (!rows.length) return null
            const total = rows.reduce((s, r) => s + r.total_pcu, 0)
            const days = rows[0]?.days_in_month ?? 30
            return days > 0 ? total / days : null
          }
          const rawTypes = categoryMode === 'raw' ? (RAW_CATEGORIES.find(c => c.display_category === changeCat)?.vehicle_types ?? []) : getRawTypesForCategory(plaza, changeCat, minTemplateMap)
          const rows = data.filter(r => r.plaza_name === plaza && r.month_date === month && rawTypes.includes(r.vehicle_type))
          if (!rows.length) return null
          const total = rows.reduce((s, r) => s + r.total_count, 0)
          const days = rows[0]?.days_in_month ?? 30
          return days > 0 ? total / days : null
        }
        const curr = getVal(m); const prior = getVal(priorM)
        result[plaza][fy][mAbbr] = curr !== null && prior !== null && prior > 0 ? +((curr/prior - 1)*100).toFixed(1) : null
      }
    }
    return result
  }, [data, allMonths, selectedPlazas, changeCat, mappings, minTemplateMap])

  const isLoading = loading || mapLoading

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader
        title="Stretch Analysis"
        subtitle="Compare plazas · Toggle between raw and grouped vehicle categories"
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

      {/* Map toggle — always visible when plazas selected */}
      {selectedPlazas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowMap(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: showMap ? '#1a2540' : '#fff',
              border: '1px solid #dde2ea', borderRadius: 4,
              color: showMap ? '#fff' : '#8995a8',
              padding: '6px 14px', fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans', fontWeight: showMap ? 600 : 400,
            }}
          >
            <span>🗺</span>
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
        </div>
      )}

      {/* Map panel */}
      {showMap && selectedPlazas.length > 0 && (() => {
        const mapPlazas = plazaMaster.filter(p =>
          selectedPlazas.some(n => n.toLowerCase().trim() === p.plaza_name.toLowerCase().trim())
        )
        const allConcessionPlazas = plazaMaster.filter(p =>
          (concessionaire === 'All' && spv === 'All')
            ? selectedPlazas.some(n => n.toLowerCase().trim() === p.plaza_name.toLowerCase().trim())
            : filteredPlazas.some(n => n.toLowerCase().trim() === p.plaza_name.toLowerCase().trim())
        )
        return (
          <div style={{ marginBottom: 16 }}>
            <PlazaMap
              plazas={allConcessionPlazas.length > 0 ? allConcessionPlazas : mapPlazas}
              highlightPlazas={selectedPlazas}
              height={340}
            />
            {mapPlazas.length === 0 && (
              <div style={{ fontSize: 11, color: '#b0bac8', marginTop: 6 }}>
                No coordinates available for these plazas
              </div>
            )}
          </div>
        )
      })()}

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
            {activeCategories.length > 0 && (
              <div style={{ fontSize: 11, color: '#8995a8', background: '#f8f9fb', border: '1px solid #e2e6ed', borderRadius: 4, padding: '5px 12px', display: 'inline-block' }}>
                {categoryMode === 'raw'
                  ? '⚡ Raw — all 6 vehicle types shown as-is'
                  : `📊 Grouped — comparing on: `}
                {categoryMode === 'grouped' && (
                  <strong style={{ color: '#1a2540' }}>{activeCategories.map(c => c.display_category).join(' · ')}</strong>
                )}
                {categoryMode === 'grouped' && (
                  <span style={{ marginLeft: 8, color: '#b0bac8' }}>— based on most grouped template</span>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '2px solid #e2e6ed' }}>
            <div style={{ display: 'flex', gap: 0 }}>
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
            {/* Raw / Grouped toggle */}
            <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden', marginBottom: 2 }}>
              {([['raw', '⚡ Raw Categories'], ['grouped', '📊 Grouped']] as [string, string][]).map(([val, lbl]) => (
                <button key={val} onClick={() => setCategoryMode(val as 'raw' | 'grouped')} style={{
                  padding: '5px 14px', fontSize: 11, fontFamily: 'DM Sans',
                  background: categoryMode === val ? '#1a2540' : '#fff',
                  color: categoryMode === val ? '#fff' : '#8995a8',
                  border: 'none', cursor: 'pointer',
                  fontWeight: categoryMode === val ? 600 : 400,
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Tab 1 — Traffic Trends */}
          {activeTab === 'trends' && (
            <>
              {/* Total ADPCU */}
              <TrendChart title="Total ADPCU — Avg Daily PCU" chartData={adpcuChart} plazas={selectedPlazas} />

              {/* Per category — based on minimum (most grouped) template */}
              {activeCategories.map(cat => (
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
              {/* Controls row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {/* ADPCU first, then vehicle categories */}
                  {[{ display_category: 'ADPCU', display_order: 0 }, ...activeCategories].map(cat => (
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
                <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden' }}>
                  {(['chronological', 'FY × Month Grid'] as const).map((val, i) => (
                    <button key={val} onClick={() => setChangeView(i === 0 ? 'chronological' : 'grid')} style={{
                      padding: '5px 14px',
                      background: (i === 0 ? changeView === 'chronological' : changeView === 'grid') ? '#1a2540' : '#fff',
                      color: (i === 0 ? changeView === 'chronological' : changeView === 'grid') ? '#fff' : '#8995a8',
                      border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 11,
                      fontWeight: (i === 0 ? changeView === 'chronological' : changeView === 'grid') ? 600 : 400,
                    }}>{val}</button>
                  ))}
                </div>
              </div>

              {changeView === 'chronological' && (
                <>
                  <ChangeTable title="Month-on-Month % Change" rows={momRows} plazas={selectedPlazas} />
                  <ChangeTable title="Year-on-Year % Change (same month prior year)" rows={yoyRows} plazas={selectedPlazas} />
                </>
              )}
              {changeView === 'grid' && (
                <>
                  <GridTable title="Month-on-Month % Change" plazaFYData={momGridData} plazas={selectedPlazas} />
                  <GridTable title="Year-on-Year % Change (same month prior year)" plazaFYData={yoyGridData} plazas={selectedPlazas} />
                </>
              )}
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
