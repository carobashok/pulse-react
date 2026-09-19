import React, { useMemo, useState } from 'react'
import { useCAGR, type CAGRSummaryRow } from '../hooks/useCAGR'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { fmtNum, type Notation } from '../lib/formatters'
import { PageHeader, NotationToggle, EmptyState } from '../components/UI'

// ─── Types ────────────────────────────────────────────────────────────────────

type PartialType = 'full' | 'start' | 'end' | 'mid' | null

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
  const { concessionaires, getSpvs, getPlazas } = useConcessionaires()

  const [notation,       setNotation]       = useState<Notation>('Indian')
  const [search,         setSearch]         = useState('')
  const [concessionaire, setConcessionaire] = useState('All')
  const [spv,            setSpv]            = useState('All')

  // Cascading
  const spvOptions     = getSpvs(concessionaire)
  const concPlazas     = (concessionaire === 'All' && spv === 'All')
    ? null
    : new Set(getPlazas(concessionaire, spv).map(p => p.toLowerCase().trim()))

  function handleConcChange(val: string) { setConcessionaire(val); setSpv('All') }

  const filtered = useMemo(() => {
    if (concPlazas) return data.filter(r => concPlazas.has(r.plaza_name.toLowerCase().trim()))
    return data
  }, [data, concPlazas])

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
          <select value={spv} onChange={e => setSpv(e.target.value)} style={selStyle}>
            <option value="All">All SPVs</option>
            {spvOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Search */}
        <div style={{ ...filterWrap, flex: '2 1 240px' }}>
          <label style={lblStyle}>Search Plaza / PIU / RO</label>
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
      <div style={{ fontSize: 12, color: '#8995a8', marginBottom: 10 }}>
        <strong style={{ color: '#1a2540' }}>{displayRows.length.toLocaleString('en-IN')}</strong> plazas
        {search && ` matching "${search}"`}
      </div>

      {/* Table */}
      {displayRows.length === 0
        ? <EmptyState message="No data found" />
        : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', border: '1px solid #e2e6ed', borderRadius: 6, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  {['Plaza', 'PIU', 'RO', ...allFYs, 'CAGR', 'YoY%', 'CAGR Period'].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px',
                      textAlign: ['Plaza', 'PIU', 'RO', 'CAGR Period'].includes(h) ? 'left' : 'right',
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
                    <td style={{ ...td('left'), color: '#8995a8', minWidth: 90 }}>{row.piu || '—'}</td>
                    <td style={{ ...td('left'), color: '#8995a8', minWidth: 90 }}>{row.ro  || '—'}</td>

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
