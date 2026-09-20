import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useCAGR, type CAGRSummaryRow } from '../hooks/useCAGR'
import { usePlazaList } from '../hooks/usePlazaList'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { fmtNum, type Notation } from '../lib/formatters'
import { PageHeader, NotationToggle, EmptyState } from '../components/UI'

// ─── Types ────────────────────────────────────────────────────────────────────

type PartialType = 'full' | 'start' | 'end' | 'mid' | 'both' | null

interface PlazaRow {
  plaza_name: string
  piu: string
  ro: string
  fySeries: Record<string, { revenue: number; partial: PartialType; months: number }>
  cagr: number | null
  cagrPeriod: string
  yoy: number | null
  yoyLabel: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fySort(a: string, b: string) { return a.localeCompare(b) }

function buildPlazaRows(data: CAGRSummaryRow[]): { rows: PlazaRow[]; allFYs: string[] } {
  if (!data.length) return { rows: [], allFYs: [] }

  const allFYs = [...new Set(data.map(r => r.fy))].sort(fySort)
  const globalLatestFY = allFYs.at(-1) ?? ''

  // Group by plaza
  const byPlaza: Record<string, CAGRSummaryRow[]> = {}
  for (const r of data) {
    if (!byPlaza[r.plaza_name]) byPlaza[r.plaza_name] = []
    byPlaza[r.plaza_name].push(r)
  }

  const rows: PlazaRow[] = []

  for (const [plaza, plazaRows] of Object.entries(byPlaza)) {
    const sorted     = plazaRows.sort((a, b) => fySort(a.fy, b.fy))
    const plazaFYs   = sorted.map(r => r.fy)
    const latestRow  = sorted.at(-1)!
    const piu        = latestRow.piu ?? ''
    const ro         = latestRow.ro  ?? ''

    // Build fySeries with partial detection using months_data
    const fySeries: PlazaRow['fySeries'] = {}
    for (const r of sorted) {
      const isFull = r.months_data === 12
      let partial: PartialType = 'full'
      if (!isFull) {
        if (r.fy === plazaFYs[0] && r.fy === plazaFYs.at(-1)) partial = 'both'
        else if (r.fy === plazaFYs[0])  partial = 'start'
        else if (r.fy === plazaFYs.at(-1)) partial = 'end'
        else partial = 'mid'
      }
      fySeries[r.fy] = { revenue: r.total_amount, partial, months: r.months_data }
    }

    // CAGR — complete FYs only
    const completeFYs = plazaFYs.filter(fy => fySeries[fy].partial === 'full')
    let cagr: number | null = null
    let cagrPeriod = 'Need ≥2 full years'
    if (completeFYs.length >= 2) {
      const startFY  = completeFYs[0]
      const endFY    = completeFYs.at(-1)!
      const nYears   = completeFYs.length - 1
      const startVal = fySeries[startFY].revenue
      const endVal   = fySeries[endFY].revenue
      if (startVal > 0) {
        cagr = ((endVal / startVal) ** (1 / nYears) - 1) * 100
        cagrPeriod = `${startFY} → ${endFY} (${nYears}yr)`
      }
    }

    // YoY — using months_data for common month count approximation
    // Latest vs previous FY, only if plaza is active in global latest FY
    let yoy: number | null = null
    let yoyLabel = 'N/A'
    const latestPlazaFY = plazaFYs.at(-1)!
    if (plazaFYs.length >= 2 && latestPlazaFY === globalLatestFY) {
      const prevRow    = sorted.at(-2)!
      const latestData = sorted.at(-1)!
      // Common months = min of both FYs month count
      const commonMonths = Math.min(latestData.months_data, prevRow.months_data)
      if (commonMonths > 0 && prevRow.total_amount > 0) {
        // Scale prev revenue to same number of months as latest
        const scaledPrev = (prevRow.total_amount / prevRow.months_data) * commonMonths
        const scaledLatest = (latestData.total_amount / latestData.months_data) * commonMonths
        yoy = ((scaledLatest / scaledPrev) - 1) * 100
        yoyLabel = `${commonMonths}m`
      }
    }

    rows.push({ plaza_name: plaza, piu, ro, fySeries, cagr, cagrPeriod, yoy, yoyLabel })
  }

  // Sort by latest full FY revenue descending
  const fullFYs = allFYs.filter(fy => rows.some(r => r.fySeries[fy]?.partial === 'full'))
  const sortFY  = fullFYs.at(-1) ?? allFYs.at(-1) ?? ''
  rows.sort((a, b) => (b.fySeries[sortFY]?.revenue ?? -1) - (a.fySeries[sortFY]?.revenue ?? -1))

  return { rows, allFYs }
}

// ─── Cell style helpers ───────────────────────────────────────────────────────

function partialColor(partial: PartialType): string | undefined {
  if (partial === 'start') return '#7F77DD'
  if (partial === 'end')   return '#BA7517'
  if (partial === 'mid')   return '#E24B4A'
  if (partial === 'both')  return '#7F77DD'
  return undefined
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CAGRPage() {
  const { data, loading, error } = useCAGR()
  const { plazas: allPlazas }    = usePlazaList()
  const { concessionaires, getSpvs, getPlazas } = useConcessionaires()

  const [notation,        setNotation]        = useState<Notation>('Indian')
  const [search,          setSearch]          = useState('')
  const [concessionaire,  setConcessionaire]  = useState('All')
  const [spv,             setSpv]             = useState('All')
  const [selectedPlazas,  setSelectedPlazas]  = useState<string[]>([])
  const [plazaSearch,     setPlazaSearch]     = useState('')
  const [plazaDropOpen,   setPlazaDropOpen]   = useState(false)

  const plazaDropRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (plazaDropRef.current && !plazaDropRef.current.contains(e.target as Node))
        setPlazaDropOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Cascading
  const spvOptions     = getSpvs(concessionaire)
  const filteredPlazas = (concessionaire === 'All' && spv === 'All')
    ? allPlazas
    : getPlazas(concessionaire, spv)

  const concPlazaSet = (concessionaire === 'All' && spv === 'All')
    ? null
    : new Set(filteredPlazas.map(p => p.toLowerCase().trim()))

  function handleConcChange(val: string) { setConcessionaire(val); setSpv('All'); setSelectedPlazas([]) }
  function handleSpvChange(val: string)  { setSpv(val); setSelectedPlazas([]) }
  function togglePlaza(p: string) {
    setSelectedPlazas(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const filtered = useMemo(() => {
    let d = data
    if (concPlazaSet) d = d.filter(r => concPlazaSet.has(r.plaza_name.toLowerCase().trim()))
    if (selectedPlazas.length > 0) {
      const sel = new Set(selectedPlazas.map(p => p.toLowerCase().trim()))
      d = d.filter(r => sel.has(r.plaza_name.toLowerCase().trim()))
    }
    return d
  }, [data, concPlazaSet, selectedPlazas])

  const { rows, allFYs } = useMemo(() => buildPlazaRows(filtered), [filtered])

  // Search filter
  const displayRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.plaza_name.toLowerCase().includes(q) ||
      r.piu.toLowerCase().includes(q) ||
      r.ro.toLowerCase().includes(q)
    )
  }, [rows, search])

  if (loading) return <Wrap><EmptyState message="Loading CAGR data…" /></Wrap>
  if (error)   return <Wrap><EmptyState message={`Error: ${error}`} /></Wrap>

  return (
    <Wrap>
      <PageHeader
        title="Plaza Revenue CAGR"
        subtitle="CAGR computed on complete financial years only · Partial years shown in colour"
      >
        <NotationToggle value={notation} onChange={setNotation} />
      </PageHeader>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        {/* Concessionaire */}
        <div style={filterWrap}>
          <label style={lblStyle}>Concessionaire</label>
          <select value={concessionaire} onChange={e => handleConcChange(e.target.value)} style={selStyle}>
            <option value="All">All Concessionaires</option>
            {concessionaires.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {/* SPV */}
        <div style={filterWrap}>
          <label style={lblStyle}>SPV / Project</label>
          <select value={spv} onChange={e => handleSpvChange(e.target.value)} style={selStyle}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Plaza multi-select */}
        <div ref={plazaDropRef} style={{ flex: '2 1 280px', position: 'relative' }}>
          <label style={lblStyle}>Filter by Plaza</label>
          <div
            onClick={() => setPlazaDropOpen(o => !o)}
            style={{
              background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4,
              padding: '5px 10px', cursor: 'pointer', minHeight: 34,
              display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
            }}
          >
            {selectedPlazas.length === 0 && (
              <span style={{ color: '#b0bac8', fontSize: 12 }}>All plazas — click to filter</span>
            )}
            {selectedPlazas.map(p => (
              <span key={p} style={{
                background: '#1a2540', color: '#fff', borderRadius: 3,
                padding: '1px 6px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {p}
                <span onClick={e => { e.stopPropagation(); togglePlaza(p) }}
                  style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
              </span>
            ))}
          </div>
          {plazaDropOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: '#fff', border: '1px solid #e2e6ed', borderRadius: 4,
              boxShadow: '0 4px 16px #1a254020', maxHeight: 260, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '6px 10px', borderBottom: '1px solid #e2e6ed' }}>
                <input autoFocus value={plazaSearch} onChange={e => setPlazaSearch(e.target.value)}
                  placeholder="Search plaza…"
                  style={{ width: '100%', border: '1px solid #dde2ea', borderRadius: 4, padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'DM Sans', background: '#f4f6f9' }}
                />
              </div>
              {selectedPlazas.length > 0 && (
                <div onClick={() => { setSelectedPlazas([]); setPlazaDropOpen(false) }}
                  style={{ padding: '6px 14px', fontSize: 11, color: '#c94f4f', cursor: 'pointer', borderBottom: '1px solid #f0f2f5', fontWeight: 600 }}>
                  Clear selection ({selectedPlazas.length})
                </div>
              )}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredPlazas
                  .filter(p => p.toLowerCase().includes(plazaSearch.toLowerCase()))
                  .map(p => (
                    <div key={p} onClick={() => { togglePlaza(p); setPlazaSearch('') }}
                      style={{
                        padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                        color: '#1a2540', display: 'flex', alignItems: 'center', gap: 8,
                        background: selectedPlazas.includes(p) ? '#f0f4ff' : '#fff',
                      }}
                      onMouseEnter={e => { if (!selectedPlazas.includes(p)) e.currentTarget.style.background = '#f4f6f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background = selectedPlazas.includes(p) ? '#f0f4ff' : '#fff' }}
                    >
                      <span style={{
                        width: 14, height: 14, border: '1px solid #dde2ea', borderRadius: 3, flexShrink: 0,
                        background: selectedPlazas.includes(p) ? '#1a2540' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedPlazas.includes(p) && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                      </span>
                      {p}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
        {/* Text search */}
        <div style={{ ...filterWrap, flex: '1 1 200px' }}>
          <label style={lblStyle}>Search PIU / RO</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type to filter…"
            style={{ ...selStyle, backgroundImage: 'none' }}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 11, color: '#8995a8', marginBottom: 12, padding: '8px 12px', background: '#fff', border: '1px solid #e2e6ed', borderRadius: 6 }}>
        <span><span style={{ color: '#7F77DD', fontStyle: 'italic' }}>■ Purple italic</span> = partial first year (excluded from CAGR)</span>
        <span><span style={{ color: '#BA7517', fontStyle: 'italic' }}>■ Amber italic</span> = partial latest year (excluded from CAGR)</span>
        <span><span style={{ color: '#E24B4A', fontStyle: 'italic' }}>■ Red italic</span> = partial mid-year gap</span>
        <span>YoY% = latest vs previous FY (common months only · Nm = months compared)</span>
      </div>

      {/* Count */}
      <div style={{ fontSize: 12, color: '#8995a8', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span><strong style={{ color: '#1a2540' }}>{displayRows.length.toLocaleString('en-IN')}</strong> plazas</span>
        {selectedPlazas.length > 0 && (
          <span style={{ color: '#e07b10', fontSize: 11 }}>
            {selectedPlazas.length} selected
            <span onClick={() => setSelectedPlazas([])}
              style={{ marginLeft: 6, cursor: 'pointer', color: '#c94f4f', fontWeight: 600 }}>× Clear</span>
          </span>
        )}
        {search && <span>matching "{search}"</span>}
      </div>

      {/* Table */}
      {displayRows.length === 0
        ? <EmptyState message="No data found" />
        : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', border: '1px solid #e2e6ed', borderRadius: 6, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  {['Plaza', ...allFYs, 'CAGR', 'YoY%', 'CAGR Period', 'PIU', 'RO'].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px',
                      textAlign: ['Plaza', 'CAGR Period', 'PIU', 'RO'].includes(h) ? 'left' : 'right',
                      background: '#f8f9fb',
                      color: '#a0aabc',
                      fontWeight: 600,
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      borderBottom: '2px solid #e2e6ed',
                      fontFamily: 'DM Sans',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, ri) => (
                  <tr key={row.plaza_name} style={{
                    background: ri % 2 === 0 ? '#fff' : '#fafbfc',
                    borderBottom: '1px solid #f0f2f5',
                  }}>
                    {/* Plaza */}
                    <td style={{ ...td('left'), fontWeight: 600, color: '#1a2540', minWidth: 220 }}>{row.plaza_name}</td>

                    {/* FY columns */}
                    {allFYs.map(fy => {
                      const entry   = row.fySeries[fy]
                      const color   = entry ? partialColor(entry.partial) : undefined
                      const italic  = entry && entry.partial !== 'full'
                      return (
                        <td key={fy} style={{
                          ...td('right'),
                          color:      color ?? '#1a2540',
                          fontStyle:  italic ? 'italic' : 'normal',
                          fontFamily: 'DM Mono',
                          minWidth:   90,
                        }}>
                          {entry ? fmtNum(entry.revenue, notation) : <span style={{ color: '#d0d5dd' }}>—</span>}
                        </td>
                      )
                    })}

                    {/* CAGR */}
                    <td style={{
                      ...td('right'),
                      color: row.cagr === null ? '#b0bac8' : row.cagr >= 0 ? '#16a085' : '#c94f4f',
                      fontWeight: 600,
                      fontFamily: 'DM Mono',
                      minWidth: 70,
                    }}>
                      {row.cagr === null ? 'N/A' : `${row.cagr >= 0 ? '+' : ''}${row.cagr.toFixed(2)}%`}
                    </td>

                    {/* YoY */}
                    <td style={{
                      ...td('right'),
                      color: row.yoy === null ? '#b0bac8' : row.yoy >= 0 ? '#16a085' : '#c94f4f',
                      fontWeight: 600,
                      fontFamily: 'DM Mono',
                      minWidth: 80,
                    }}>
                      {row.yoy === null
                        ? 'N/A'
                        : `${row.yoy >= 0 ? '+' : ''}${row.yoy.toFixed(2)}% (${row.yoyLabel})`
                      }
                    </td>

                    {/* CAGR Period */}
                    <td style={{ ...td('left'), color: '#8995a8', minWidth: 160 }}>{row.cagrPeriod}</td>

                    {/* PIU and RO — moved to end */}
                    <td style={{ ...td('left'), color: '#8995a8', minWidth: 100 }}>{row.piu || '—'}</td>
                    <td style={{ ...td('left'), color: '#8995a8', minWidth: 100 }}>{row.ro  || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Wrap>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function Wrap({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '24px 28px', maxWidth: 1600 }}>{children}</div>
}

function td(align: 'left' | 'right'): React.CSSProperties {
  return { padding: '7px 12px', textAlign: align, whiteSpace: 'nowrap', verticalAlign: 'middle' }
}

const filterWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }
const lblStyle:   React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em' }
const selStyle:   React.CSSProperties = {
  background: '#f4f6f9', border: '1px solid #dde2ea', borderRadius: 4,
  color: '#1a2540', padding: '6px 28px 6px 10px', fontSize: 12,
  fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238995a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
}
