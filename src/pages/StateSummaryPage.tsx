import React, { useMemo, useState } from 'react'
import { useStateSummary, type StateMonthRow } from '../hooks/useStateSummary'
import { fmtNum, MONTH_ABBR, type Notation } from '../lib/formatters'
import {
  PageHeader, FilterRow, FilterSelect,
  KPIStrip, KPICard, SectionCard,
  EmptyState, NotationToggle,
} from '../components/UI'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BLANK = '(blank)'

// 'YYYY-MM-DD' -> month index (year*12 + month-1) and label
function parseMonth(m: string) {
  const [y, mo] = m.slice(0, 10).split('-').map(Number)
  return { idx: y * 12 + (mo - 1), cal: mo, year: y, key: `${y}-${String(mo).padStart(2, '0')}` }
}
function monthLabel(idx: number) {
  const y = Math.floor(idx / 12), m = (idx % 12) + 1
  return `${MONTH_ABBR[m]}-${y}`
}

interface Agg { total: number; days: number; plazas: number }

// Sum rows per state. days = calendar days of the months in which the state has data.
function aggregate(rows: StateMonthRow[]): Map<string, Agg> {
  const m = new Map<string, Agg>()
  for (const r of rows) {
    const a = m.get(r.state) ?? { total: 0, days: 0, plazas: 0 }
    a.total  += r.total_amount
    a.days   += r.days_in_month
    a.plazas  = Math.max(a.plazas, r.plazas)
    m.set(r.state, a)
  }
  return m
}
const adcOf = (a: Agg | undefined) => (a && a.days > 0 ? a.total / a.days : 0)

type SortKey = 'state' | 'total' | 'adc' | 'share' | 'plazas' | 'yoy'

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StateSummaryPage() {
  const { data, loading, error } = useStateSummary()

  const [notation,   setNotation]   = useState<Notation>('Indian')
  const [periodType, setPeriodType] = useState<'fy' | 'month' | 'custom'>('fy')
  const [fySel,      setFySel]      = useState('')
  const [monthSel,   setMonthSel]   = useState('')
  const [fromSel,    setFromSel]    = useState('')
  const [toSel,      setToSel]      = useState('')
  const [yMetric,    setYMetric]    = useState<'adc' | 'total'>('adc')
  const [sort,       setSort]       = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'total', dir: -1 })

  const parsed = useMemo(() => data.map(r => ({ r, p: parseMonth(r.month) })), [data])

  const fys = useMemo(() => [...new Set(data.map(r => r.fy))].sort(), [data])
  const months = useMemo(() => {
    const s = new Map<string, number>()
    for (const { p } of parsed) s.set(p.key, p.idx)
    return [...s.entries()].sort((a, b) => a[1] - b[1]).map(([key, idx]) => ({ key, idx, label: monthLabel(idx) }))
  }, [parsed])

  // Defaults: latest financial year (to date) / latest month
  const fy    = fySel    || fys.at(-1) || ''
  const mSel  = monthSel || months.at(-1)?.key || ''
  const mFrom = fromSel  || months.at(0)?.key  || ''
  const mTo   = toSel    || months.at(-1)?.key || ''
  const keyToIdx = (k: string) => months.find(m => m.key === k)?.idx ?? 0

  // Rows in the selected period, and the month indexes they cover
  const { cur, curIdx } = useMemo(() => {
    const sel = parsed.filter(({ r, p }) => {
      if (periodType === 'fy')    return r.fy === fy
      if (periodType === 'month') return p.key === mSel
      return p.idx >= keyToIdx(mFrom) && p.idx <= keyToIdx(mTo)
    })
    return { cur: sel.map(x => x.r), curIdx: new Set(sel.map(x => x.p.idx)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, periodType, fy, mSel, mFrom, mTo, months])

  // Same months one year earlier — for like-for-like growth
  const prev = useMemo(
    () => parsed.filter(({ p }) => curIdx.has(p.idx + 12)).map(x => x.r),
    [parsed, curIdx]
  )

  const stateRows = useMemo(() => {
    const a = aggregate(cur), b = aggregate(prev)
    const total = [...a.values()].reduce((s, x) => s + x.total, 0)
    const rows = [...a.entries()].map(([state, x]) => {
      const adc = adcOf(x), pAdc = adcOf(b.get(state))
      return { state, total: x.total, adc, plazas: x.plazas, share: total > 0 ? (x.total / total) * 100 : 0, yoy: pAdc > 0 ? (adc / pAdc - 1) * 100 : null }
    })
    const dir = sort.dir
    rows.sort((p, q) => {
      if (p.state === BLANK) return 1
      if (q.state === BLANK) return -1
      if (sort.k === 'state') return dir * p.state.localeCompare(q.state)
      const x = ((p as Record<string, unknown>)[sort.k] as number | null) ?? -Infinity
      const y = ((q as Record<string, unknown>)[sort.k] as number | null) ?? -Infinity
      return dir * (x - y)
    })
    return { rows, total, adc: rows.reduce((s, x) => s + x.adc, 0) }
  }, [cur, prev, sort])

  const topState = [...stateRows.rows].filter(r => r.state !== BLANK).sort((a, b) => b.total - a.total)[0]
  const blankRow = stateRows.rows.find(r => r.state === BLANK)
  const maxTotal = Math.max(...stateRows.rows.map(r => r.total), 1)

  // Year-wise table: every FY with data
  const yearWise = useMemo(() => {
    const byFy = new Map<string, StateMonthRow[]>()
    for (const r of data) { const l = byFy.get(r.fy) ?? []; l.push(r); byFy.set(r.fy, l) }
    const cols = fys.map(f => {
      const rows = byFy.get(f) ?? []
      const idxs = [...new Set(rows.map(r => parseMonth(r.month).idx))].sort((a, b) => a - b)
      const part = idxs.length < 12 ? `${monthLabel(idxs[0]).slice(0, 3)}–${monthLabel(idxs.at(-1)!).slice(0, 3)}` : ''
      return { fy: f, agg: aggregate(rows), part, months: idxs.length }
    })
    const states = [...new Set(data.map(r => r.state))]
    const last = cols.at(-1)
    states.sort((a, b) => {
      if (a === BLANK) return 1
      if (b === BLANK) return -1
      return adcOf(last?.agg.get(b)) - adcOf(last?.agg.get(a))
    })
    return { cols, states }
  }, [data, fys])

  function sortBy(k: SortKey) {
    setSort(s => s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === 'state' ? 1 : -1 })
  }

  if (loading) return <Wrap><EmptyState message="Loading data…" /></Wrap>
  if (error)   return <Wrap><EmptyState message={`Error: ${error}`} /></Wrap>
  if (!data.length) return <Wrap><EmptyState message="No data returned — has the get_state_month_summary function been created?" /></Wrap>

  const periodLabel = curIdx.size === 0 ? 'No data for this period'
    : periodType === 'fy'
    ? `${fy}${curIdx.size < 12 ? ` · ${monthLabel(Math.min(...curIdx))} – ${monthLabel(Math.max(...curIdx))}` : ''}`
    : periodType === 'month' ? (months.find(m => m.key === mSel)?.label ?? '')
    : `${months.find(m => m.key === mFrom)?.label} – ${months.find(m => m.key === mTo)?.label}`

  return (
    <Wrap>
      <PageHeader title="State Summary" subtitle="Collection by state — total and average daily collection (ADC)">
        <NotationToggle value={notation} onChange={setNotation} />
      </PageHeader>

      <FilterRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={lblStyle}>Period</label>
          <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden' }}>
            {([['fy', 'Financial year'], ['month', 'Month'], ['custom', 'Custom']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setPeriodType(v)} style={segBtn(periodType === v)}>{l}</button>
            ))}
          </div>
        </div>
        {periodType === 'fy' && (
          <FilterSelect label="Financial year" value={fy} onChange={setFySel} width={160}
            options={[...fys].reverse().map(f => ({ value: f, label: f }))} />
        )}
        {periodType === 'month' && (
          <FilterSelect label="Month" value={mSel} onChange={setMonthSel} width={160}
            options={[...months].reverse().map(m => ({ value: m.key, label: m.label }))} />
        )}
        {periodType === 'custom' && (
          <>
            <FilterSelect label="From" value={mFrom} onChange={setFromSel} width={140}
              options={months.map(m => ({ value: m.key, label: m.label }))} />
            <FilterSelect label="To" value={mTo} onChange={setToSel} width={140}
              options={months.map(m => ({ value: m.key, label: m.label }))} />
          </>
        )}
        <button onClick={() => { setPeriodType('fy'); setFySel(''); setMonthSel(''); setFromSel(''); setToSel('') }}
          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#3d7ab5', fontSize: 11, cursor: 'pointer', padding: '8px 4px' }}>
          Reset filters
        </button>
      </FilterRow>

      <div style={{ fontSize: 10, color: '#a0aabc', marginBottom: 8, letterSpacing: '0.03em' }}>{periodLabel}</div>
      <KPIStrip>
        <KPICard accent label="Total collection" value={fmtNum(stateRows.total, notation)} />
        <KPICard label="ADC" value={fmtNum(stateRows.adc, notation)} unit="/ day" />
        <KPICard label="States" value={String(stateRows.rows.filter(r => r.state !== BLANK).length)} />
        <KPICard label="Top state" value={topState ? `${topState.state} · ${Math.round(topState.share)}%` : '—'} />
        <KPICard label="No state recorded" value={blankRow ? `${blankRow.plazas} plazas` : '0 plazas'} />
      </KPIStrip>

      <SectionCard title={`Collection by state  ·  ${periodLabel}`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
                <Th onClick={() => sortBy('state')} active={sort.k === 'state'} dir={sort.dir}>State</Th>
                <th style={{ ...thS, width: '22%' }} />
                <Th num onClick={() => sortBy('total')}  active={sort.k === 'total'}  dir={sort.dir}>Total</Th>
                <Th num onClick={() => sortBy('adc')}    active={sort.k === 'adc'}    dir={sort.dir}>ADC / day</Th>
                <Th num onClick={() => sortBy('share')}  active={sort.k === 'share'}  dir={sort.dir}>Share</Th>
                <Th num onClick={() => sortBy('plazas')} active={sort.k === 'plazas'} dir={sort.dir}>Plazas</Th>
                <Th num onClick={() => sortBy('yoy')}    active={sort.k === 'yoy'}    dir={sort.dir}>YoY (ADC)</Th>
              </tr>
            </thead>
            <tbody>
              {stateRows.rows.map((r, i) => {
                const blank = r.state === BLANK
                return (
                  <tr key={r.state} style={{ background: i % 2 ? '#fafbfc' : '#fff', borderBottom: '1px solid #f0f2f5' }}>
                    <td style={{ padding: '7px 12px', color: blank ? '#e07b10' : '#1a2540', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.state}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ height: 9, borderRadius: 2, width: `${Math.max(2, (r.total / maxTotal) * 100)}%`, background: blank ? '#e07b10' : '#3d7ab5' }} />
                    </td>
                    <td style={tdNum}>{fmtNum(r.total, notation)}</td>
                    <td style={tdNum}>{fmtNum(r.adc, notation)}</td>
                    <td style={tdNum}>{r.share.toFixed(1)}%</td>
                    <td style={tdNum}>{r.plazas}</td>
                    <td style={{ ...tdNum, color: r.yoy == null ? '#c0c8d4' : r.yoy >= 0 ? '#16a085' : '#c0392b' }}>
                      {r.yoy == null ? '—' : `${r.yoy >= 0 ? '+' : ''}${r.yoy.toFixed(1)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={noteStyle}>
          ADC = collection ÷ days in the months that have data. YoY compares ADC with the same months a year earlier.
          Plazas = the most plazas reporting in any month of the period. “(blank)” = plazas with no state in Plaza Details.
        </div>
      </SectionCard>

      <SectionCard title="Year-wise collection by state">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden' }}>
            {([['adc', 'ADC / day'], ['total', 'Total']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setYMetric(v)} style={segBtn(yMetric === v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e2e6ed' }}>
                <th style={{ ...thS, position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 1 }}>State</th>
                {yearWise.cols.map(c => (
                  <th key={c.fy} style={{ ...thS, textAlign: 'right', color: c.fy === fys.at(-1) ? '#e07b10' : '#a0aabc' }}>
                    {c.fy.replace('FY ', '')}
                    {c.part && <div style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>{c.part}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearWise.states.map((s, i) => (
                <tr key={s} style={{ background: i % 2 ? '#fafbfc' : '#fff', borderBottom: '1px solid #f0f2f5' }}>
                  <td style={{ padding: '7px 12px', fontWeight: 500, whiteSpace: 'nowrap', color: s === BLANK ? '#e07b10' : '#1a2540', position: 'sticky', left: 0, background: i % 2 ? '#fafbfc' : '#fff' }}>{s}</td>
                  {yearWise.cols.map(c => {
                    const a = c.agg.get(s)
                    return (
                      <td key={c.fy} style={tdNum}>
                        {a ? (
                          <>
                            {fmtNum(yMetric === 'adc' ? adcOf(a) : a.total, notation)}
                            <div style={{ fontSize: 9, color: '#b0bac8' }}>{a.plazas} plazas</div>
                          </>
                        ) : <span style={{ color: '#d0d5dd' }}>—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #e2e6ed', fontWeight: 600 }}>
                <td style={{ padding: '7px 12px', position: 'sticky', left: 0, background: '#fff' }}>All states</td>
                {yearWise.cols.map(c => {
                  const all = [...c.agg.values()]
                  const t = all.reduce((s, x) => s + x.total, 0)
                  const adc = all.reduce((s, x) => s + (x.days > 0 ? x.total / x.days : 0), 0)
                  return <td key={c.fy} style={tdNum}>{fmtNum(yMetric === 'adc' ? adc : t, notation)}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={noteStyle}>
          Every financial year with data. Part years show the months they cover, and ADC keeps them comparable with full years.
          Small figures show the plazas reporting that year.
        </div>
      </SectionCard>
    </Wrap>
  )
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function Wrap({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '28px 32px', maxWidth: 1400 }}>{children}</div>
}

function Th({ children, onClick, active, dir, num }: {
  children: React.ReactNode; onClick: () => void; active: boolean; dir: 1 | -1; num?: boolean
}) {
  return (
    <th onClick={onClick} style={{ ...thS, cursor: 'pointer', textAlign: num ? 'right' : 'left', color: active ? '#1a2540' : '#a0aabc' }}>
      {children}{active ? (dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  )
}

const lblStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#a0aabc', textTransform: 'uppercase', letterSpacing: '0.07em',
}
const segBtn = (on: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 11, fontFamily: 'DM Sans', border: 'none', cursor: 'pointer',
  background: on ? '#1a2540' : '#fff', color: on ? '#fff' : '#8995a8', fontWeight: on ? 600 : 400,
})
const thS: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', color: '#a0aabc', fontWeight: 600, fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: 'DM Sans',
}
const tdNum: React.CSSProperties = {
  padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#1a2540', whiteSpace: 'nowrap',
}
const noteStyle: React.CSSProperties = { fontSize: 11, color: '#8995a8', marginTop: 10, lineHeight: 1.5 }
