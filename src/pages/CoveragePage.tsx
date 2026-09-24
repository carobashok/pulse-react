import React, { useMemo, useState } from 'react'
import { useCAGR } from '../hooks/useCAGR'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { PageHeader, EmptyState } from '../components/UI'

const FY_MONTHS = 12

// How many months have elapsed in the current FY so far
function monthsElapsedInFY(): number {
  const now   = new Date()
  const month = now.getMonth() + 1 // 1-12
  const fyStartMonth = 4 // April
  if (month >= fyStartMonth) return month - fyStartMonth + 1
  return month + (12 - fyStartMonth + 1)
}

// Get current FY string e.g. "FY 2026-27"
function currentFY(): string {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  if (month >= 4) return `FY ${year}-${String(year + 1).slice(-2)}`
  return `FY ${year - 1}-${String(year).slice(-2)}`
}

const ELAPSED = monthsElapsedInFY()
const CURR_FY = currentFY()

function monthColor(months: number | null, fy: string): string {
  if (months === null) return '#f0f2f5'
  const isCurrent = fy === CURR_FY
  if (isCurrent) {
    // For current FY — compare against months elapsed
    // Data available up to last month means months === ELAPSED - 1 or ELAPSED
    if (months >= ELAPSED - 1) return '#d1fae5'  // up to date — green
    if (months >= ELAPSED - 3) return '#fef3c7'  // slightly behind — amber
    return '#fee2e2'                               // significantly behind — red
  }
  // Past FYs — standard logic
  if (months === 12) return '#d1fae5'
  if (months >= 9)   return '#fef3c7'
  if (months >= 6)   return '#fed7aa'
  return '#fee2e2'
}

function monthText(months: number | null, fy: string): string {
  if (months === null) return '—'
  const isCurrent = fy === CURR_FY
  if (isCurrent) {
    if (months >= ELAPSED - 1) return `${months}m ✓`
    return `${months}m`
  }
  return `${months}m`
}

function fySort(a: string, b: string) { return a.localeCompare(b) }

export default function CoveragePage() {
  const { data, loading, error } = useCAGR()
  const { concessionaires, getSpvs, getPlazas } = useConcessionaires()

  const [search,        setSearch]        = useState('')
  const [concessionaire,setConcessionaire] = useState('All')
  const [spv,           setSpv]           = useState('All')
  const [filterFY,      setFilterFY]      = useState('All')
  const [statFilter,    setStatFilter]    = useState<'all'|'full'|'partial'|'missing'>('all')

  const spvOptions     = getSpvs(concessionaire)
  const concPlazaNames = useMemo(() => {
    if (concessionaire === 'All' && spv === 'All') return null
    return new Set(getPlazas(concessionaire, spv).map(p => p.toLowerCase().trim()))
  }, [concessionaire, spv])

  // Build coverage matrix — plaza × FY → months_data
  const { matrix, allFYs, plazaList } = useMemo(() => {
    if (!data.length) return { matrix: {}, allFYs: [], plazaList: [] }

    const allFYs = [...new Set(data.map(r => r.fy))].sort(fySort)
    const mat: Record<string, Record<string, number>> = {}

    for (const row of data) {
      if (!mat[row.plaza_name]) mat[row.plaza_name] = {}
      mat[row.plaza_name][row.fy] = row.months_data
    }

    return { matrix: mat, allFYs, plazaList: Object.keys(mat).sort() }
  }, [data])

  // Filtered plazas
  const displayPlazas = useMemo(() => {
    let list = plazaList
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.toLowerCase().includes(q))
    }
    if (concPlazaNames) {
      list = list.filter(p => concPlazaNames.has(p.toLowerCase().trim()))
    }
    if (filterFY !== 'All') {
      list = list.filter(p => matrix[p]?.[filterFY] != null)
    }
    if (statFilter === 'full') {
      list = list.filter(p => {
        const hasFYs = allFYs.filter(fy => matrix[p]?.[fy] != null)
        if (!hasFYs.length) return false
        const firstFY = hasFYs[0]; const lastFY = hasFYs.at(-1)!
        const range = allFYs.slice(allFYs.indexOf(firstFY), allFYs.indexOf(lastFY) + 1)
        if (range.some(fy => matrix[p]?.[fy] == null)) return false
        const pastOk = range.filter(fy => fy !== CURR_FY).every(fy => (matrix[p]?.[fy] ?? 0) === 12)
        const currM  = matrix[p]?.[CURR_FY] ?? null
        const currOk = currM === null || currM >= ELAPSED - 1
        return pastOk && currOk
      })
    } else if (statFilter === 'partial') {
      list = list.filter(p => {
        const hasFYs  = allFYs.filter(fy => matrix[p]?.[fy] != null)
        if (!hasFYs.length) return false
        const firstFY = hasFYs[0]; const lastFY = hasFYs.at(-1)!
        const fyRange = allFYs.slice(allFYs.indexOf(firstFY), allFYs.indexOf(lastFY) + 1)
        if (fyRange.some(fy => matrix[p]?.[fy] == null)) return false // gap, not partial
        const pastPartial = fyRange.filter(fy => fy !== CURR_FY).some(fy => (matrix[p]?.[fy] ?? 0) < 12)
        const currM = matrix[p]?.[CURR_FY] ?? null
        const currPartial = currM !== null && currM < ELAPSED - 1
        return pastPartial || currPartial
      })
    } else if (statFilter === 'missing') {
      // Gap: one or more entire FYs missing between first and last active FY
      list = list.filter(p => {
        const hasFYs = allFYs.filter(fy => matrix[p]?.[fy] != null)
        if (!hasFYs.length) return true
        const firstFY = hasFYs[0]; const lastFY = hasFYs.at(-1)!
        const fyRange = allFYs.slice(allFYs.indexOf(firstFY), allFYs.indexOf(lastFY) + 1)
        return fyRange.some(fy => matrix[p]?.[fy] == null)
      })
    }
    return list
  }, [plazaList, search, concPlazaNames, filterFY, statFilter, matrix, allFYs])

  // Stats — based on filtered list WITHOUT statFilter applied
  const basePlazas = useMemo(() => {
    let list = plazaList
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.toLowerCase().includes(q))
    }
    if (concPlazaNames) list = list.filter(p => concPlazaNames.has(p.toLowerCase().trim()))
    if (filterFY !== 'All') list = list.filter(p => matrix[p]?.[filterFY] != null)
    return list
  }, [plazaList, search, concPlazaNames, filterFY, matrix])

  const stats = useMemo(() => {
    // Helper — get FY range a plaza is active in
    function getRange(p: string) {
      const hasFYs = allFYs.filter(fy => matrix[p]?.[fy] != null)
      if (!hasFYs.length) return []
      const firstFY = hasFYs[0]; const lastFY = hasFYs.at(-1)!
      return allFYs.slice(allFYs.indexOf(firstFY), allFYs.indexOf(lastFY) + 1)
    }

    const full = basePlazas.filter(p => {
      const range = getRange(p)
      if (!range.length) return false
      if (range.some(fy => matrix[p]?.[fy] == null)) return false // has gap
      const pastOk = range.filter(fy => fy !== CURR_FY).every(fy => (matrix[p]?.[fy] ?? 0) === 12)
      const currM  = matrix[p]?.[CURR_FY] ?? null
      const currOk = currM === null || currM >= ELAPSED - 1
      return pastOk && currOk
    }).length

    const gap = basePlazas.filter(p => {
      const range = getRange(p)
      if (!range.length) return true
      return range.some(fy => matrix[p]?.[fy] == null)
    }).length

    const partial = basePlazas.filter(p => {
      const range = getRange(p)
      if (!range.length) return false
      if (range.some(fy => matrix[p]?.[fy] == null)) return false // gap not partial
      const pastPartial = range.filter(fy => fy !== CURR_FY).some(fy => (matrix[p]?.[fy] ?? 0) < 12)
      const currM = matrix[p]?.[CURR_FY] ?? null
      const currPartial = currM !== null && currM < ELAPSED - 1
      return pastPartial || currPartial
    }).length

    return { full, partial, gap }
  }, [basePlazas, allFYs, matrix])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <PageHeader
        title="Data Coverage"
        subtitle="Number of months of data available per plaza per financial year"
      />

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#8995a8', fontWeight: 600 }}>Past FYs:</span>
        {[
          { color: '#d1fae5', label: '12m — Complete' },
          { color: '#fef3c7', label: '9–11m — Good'   },
          { color: '#fed7aa', label: '6–8m — Partial' },
          { color: '#fee2e2', label: '1–5m — Sparse'  },
          { color: '#f0f2f5', label: 'No data'        },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8995a8' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: '1px solid #e2e6ed' }} />
            {label}
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#8995a8', fontWeight: 600, marginLeft: 8 }}>Current FY ({CURR_FY}, {ELAPSED}m elapsed):</span>
        {[
          { color: '#d1fae5', label: 'Up to date ✓' },
          { color: '#fef3c7', label: 'Slightly behind' },
          { color: '#fee2e2', label: 'Significantly behind' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8995a8' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: '1px solid #e2e6ed' }} />
            {label}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '12px 16px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 180px' }}>
          <label style={lblS}>Search Plaza</label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Type to filter…"
            style={inpS} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={lblS}>Concessionaire</label>
          <select value={concessionaire} onChange={e => { setConcessionaire(e.target.value); setSpv('All') }} style={selS}>
            <option value="All">All Concessionaires</option>
            {concessionaires.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={lblS}>SPV / Project</label>
          <select value={spv} onChange={e => setSpv(e.target.value)} style={selS}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
          <label style={lblS}>Filter by FY</label>
          <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={selS}>
            <option value="All">All FYs</option>
            {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Plazas',  value: basePlazas.length, color: '#1a2540', key: 'all'     },
          { label: 'Complete',        value: stats.full,         color: '#16a085', key: 'full'    },
          { label: 'Partial Months',  value: stats.partial,      color: '#e07b10', key: 'partial' },
          { label: 'FY Gap',          value: stats.gap,          color: '#c94f4f', key: 'missing' },
        ].map(s => (
          <div key={s.key}
            onClick={() => setStatFilter(f => f === s.key ? 'all' : s.key as typeof statFilter)}
            style={{
              background: statFilter === s.key ? s.color : '#fff',
              border: `1px solid ${s.color}40`, borderRadius: 6,
              padding: '8px 16px', minWidth: 120, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: statFilter === s.key ? '#fff' : '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono', color: statFilter === s.key ? '#fff' : s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading && <EmptyState message="Loading coverage data…" />}
      {error   && <EmptyState message={`Error: ${error}`} />}
      {!loading && !error && (
        <div style={{ background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
                  <th style={{ ...thS, textAlign: 'left', minWidth: 220, position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 3 }}>
                    Plaza ({displayPlazas.length})
                  </th>
                  {allFYs.map(fy => (
                    <th key={fy} style={{ ...thS, minWidth: 80 }}>{fy}</th>
                  ))}
                  <th style={{ ...thS, minWidth: 80 }}>Total Months</th>
                </tr>
              </thead>
              <tbody>
                {displayPlazas.map((plaza, ri) => {
                  const totalMonths = allFYs.reduce((s, fy) => s + (matrix[plaza]?.[fy] ?? 0), 0)
                  return (
                    <tr key={plaza} style={{ borderBottom: '1px solid #f0f2f5', background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{
                        padding: '7px 14px', fontWeight: 500, color: '#1a2540',
                        position: 'sticky', left: 0, background: ri % 2 === 0 ? '#fff' : '#fafbfc',
                        borderRight: '1px solid #e2e6ed', zIndex: 1,
                      }}>
                        {plaza}
                      </td>
                      {allFYs.map(fy => {
                        const months = matrix[plaza]?.[fy] ?? null
                        return (
                          <td key={fy} style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: 11 }}>
                            <div style={{
                              background: monthColor(months, fy),
                              borderRadius: 4, padding: '3px 6px',
                              color: months === null ? '#b0bac8' : '#1a2540',
                              fontWeight: months != null ? 600 : 400,
                              display: 'inline-block', minWidth: 36,
                            }}>
                              {monthText(months, fy)}
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: 11, fontWeight: 600, color: '#1a2540' }}>
                        {totalMonths}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const lblS: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em' }
const inpS: React.CSSProperties = { background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }
const selS: React.CSSProperties = { background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4, color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12, fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }
const thS:  React.CSSProperties = { padding: '9px 8px', textAlign: 'center', color: '#a0aabc', fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }
