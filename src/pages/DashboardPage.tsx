import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { useCAGRMonthly } from '../hooks/useCAGR'
import { usePlazaList } from '../hooks/usePlazaList'
import { useConcessionaires } from '../hooks/useConcessionaires'
import { scaleSeries, fmtNum, MONTH_ORDER, MONTH_ABBR, DIVISORS, type Notation } from '../lib/formatters'
import {
  PageHeader, FilterRow, FilterSelect,
  KPIStrip, KPICard, SectionCard,
  ChartTooltip, EmptyState, NotationToggle,
} from '../components/UI'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fySort(a: string, b: string) { return a.localeCompare(b) }
function fmtTick(v: number, lbl: string) {
  const n = +v
  const fmt = n >= 1000 ? Math.round(n).toLocaleString('en-IN') : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return lbl ? `${fmt} ${lbl}` : fmt
}

// ─── Custom X-axis tick with plaza count ─────────────────────────────────────

function FYTick({ x, y, payload, plazaCounts }: {
  x?: number; y?: number
  payload?: { value: string }
  plazaCounts: Record<string, number>
}) {
  const fy    = payload?.value ?? ''
  const count = plazaCounts[fy]
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#8995a8" fontSize={10} fontFamily="DM Sans">
        {fy.replace('FY ', '')}
      </text>
      {count !== undefined && (
        <text x={0} y={0} dy={24} textAnchor="middle" fill="#b0bac8" fontSize={9} fontFamily="DM Sans">
          {count} plazas
        </text>
      )}
    </g>
  )
}

const CHART_COLORS = ['#e07b10', '#3d7ab5', '#2d5f8a', '#1f4460', '#152e42']
const yStyle = { fill: '#8995a8', fontSize: 11, fontFamily: 'DM Mono' }
const xStyle = { fill: '#8995a8', fontSize: 10, fontFamily: 'DM Sans' }

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { plazas: allPlazas } = usePlazaList()
  const { concessionaires, getSpvs, getPlazas, loading: concLoading } = useConcessionaires()

  const [concessionaire, setConcessionaire] = useState('All')
  const [spv,            setSpv]            = useState('All')
  const [plaza,          setPlaza]          = useState('All')
  const [notation,       setNotation]       = useState<Notation>('Indian')
  const [metricMode,     setMetricMode]     = useState<'PCU' | 'Traffic'>('PCU')
  const [compareMode,    setCompareMode]    = useState<'all' | 'common'>('all')
  const [trendView,      setTrendView]      = useState<'fy' | 'continuous'>('fy')

  const { data: allData, loading, error } = useCAGRMonthly(plaza)

  const usePCU = metricMode === 'PCU'

  // Cascading dropdown options
  const spvOptions     = getSpvs(concessionaire)
  const filteredPlazas = concessionaire === 'All' && spv === 'All'
    ? allPlazas  // no concessionaire selected — show all plazas
    : getPlazas(concessionaire, spv)

  // Reset downstream when upstream changes
  function handleConcessionaireChange(val: string) {
    setConcessionaire(val); setSpv('All'); setPlaza('All')
  }
  function handleSpvChange(val: string) {
    setSpv(val); setPlaza('All')
  }

  // ── Step 1: filter by concessionaire / spv / plaza ──
  const plazaFiltered = useMemo(() => {
    // Build set of plaza names to include
    if (plaza !== 'All') {
      return allData.filter(r => r.plaza_name === plaza)
    }
    if (concessionaire !== 'All' || spv !== 'All') {
      const allowedPlazas = new Set(getPlazas(concessionaire, spv).map(p => p.toLowerCase().trim()))
      return allData.filter(r => allowedPlazas.has(r.plaza_name.toLowerCase().trim()))
    }
    return allData
  }, [allData, concessionaire, spv, plaza])

  // ── Step 2: identify all FYs and their month sets per plaza ──
  const fyList = useMemo(() =>
    [...new Set(plazaFiltered.map(r => r.fy))].sort(fySort),
    [plazaFiltered]
  )

  // ── Step 3: find common plazas ──
  // For complete FYs: require all 12 months
  // For current (latest) FY: require the same month count as the best-reporting plaza
  const commonPlazas = useMemo(() => {
    if (!fyList.length) return new Set<string>()
    const latestFY = fyList.at(-1)!
    const completeFYs = fyList.slice(0, -1) // all except latest

    // Find max months any plaza has in the latest FY
    const latestFYMonthCounts: Record<string, Set<string>> = {}
    for (const r of plazaFiltered) {
      if (r.fy !== latestFY) continue
      if (!latestFYMonthCounts[r.plaza_name]) latestFYMonthCounts[r.plaza_name] = new Set()
      latestFYMonthCounts[r.plaza_name].add(r.month)
    }
    const maxLatestMonths = Math.max(...Object.values(latestFYMonthCounts).map(s => s.size), 0)

    const plazaSet = new Set(plazaFiltered.map(r => r.plaza_name))
    const common = new Set<string>()
    for (const p of plazaSet) {
      const pRows = plazaFiltered.filter(r => r.plaza_name === p)
      const fyMonths: Record<string, Set<string>> = {}
      for (const r of pRows) {
        if (!fyMonths[r.fy]) fyMonths[r.fy] = new Set()
        fyMonths[r.fy].add(r.month)
      }
      // Complete FYs must have 12 months; latest FY must match max months
      const completeOk = completeFYs.every(fy => (fyMonths[fy]?.size ?? 0) === 12)
      const latestOk   = (fyMonths[latestFY]?.size ?? 0) >= maxLatestMonths
      if (completeOk && latestOk) common.add(p)
    }
    return common
  }, [plazaFiltered, fyList])

  // ── Step 4: apply compare mode filter ──
  const filtered = useMemo(() => {
    if (compareMode === 'common') {
      return plazaFiltered.filter(r => commonPlazas.has(r.plaza_name))
    }
    return plazaFiltered
  }, [plazaFiltered, compareMode, commonPlazas])

  // ── Plaza count per FY (for remark on bars) ──
  const plazaCountByFY = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const fy of fyList) {
      counts[fy] = new Set(filtered.filter(r => r.fy === fy).map(r => r.plaza_name)).size
    }
    return counts
  }, [filtered, fyList])

  // ── FY aggregation ──
  const fyData = useMemo(() => {
    const m: Record<string, { fy: string; amount: number; pcu: number; count: number; days: number }> = {}
    // Track distinct month → days_in_month per FY (same as Python groupby MONTH, DAYS_IN_MONTH)
    const fyMonthDays: Record<string, Record<string, number>> = {}
    for (const r of filtered) {
      if (!m[r.fy]) m[r.fy] = { fy: r.fy, amount: 0, pcu: 0, count: 0, days: 0 }
      m[r.fy].amount += r.total_amount
      m[r.fy].pcu   += r.total_pcu
      m[r.fy].count += r.total_count
      // Track unique month days — one entry per calendar month, not per plaza
      if (!fyMonthDays[r.fy]) fyMonthDays[r.fy] = {}
      fyMonthDays[r.fy][r.month] = r.days_in_month
    }
    // Sum distinct calendar days per FY
    for (const fy of Object.keys(m)) {
      m[fy].days = Object.values(fyMonthDays[fy] ?? {}).reduce((s, d) => s + d, 0)
    }
    return Object.values(m).sort((a, b) => fySort(a.fy, b.fy))
  }, [filtered])

  // ── Monthly aggregation ──
  const monthly = useMemo(() => {
    const m: Record<string, { fy: string; month: string; month_str: string; cal_month: number; amount: number; pcu: number; count: number; days: number }> = {}
    // Track distinct calendar days per month (not sum across plazas)
    const monthDays: Record<string, number> = {}
    for (const r of filtered) {
      const d = new Date(r.month); const cm = d.getMonth() + 1
      const key = `${r.fy}_${r.month}`
      if (!m[key]) m[key] = { fy: r.fy, month: r.month, month_str: `${MONTH_ABBR[cm]}-${d.getFullYear()}`, cal_month: cm, amount: 0, pcu: 0, count: 0, days: r.days_in_month }
      m[key].amount += r.total_amount
      m[key].pcu   += r.total_pcu
      m[key].count += r.total_count
      // days_in_month is same for all plazas in same month — just set it
      monthDays[key] = r.days_in_month
    }
    // Attach correct days and compute ADRR/ADPCU
    return Object.values(m)
      .map(row => ({
        ...row,
        days:  monthDays[`${row.fy}_${row.month}`] ?? 30,
        adrr:  row.amount / (monthDays[`${row.fy}_${row.month}`] ?? 30),
        adpcu: row.pcu    / (monthDays[`${row.fy}_${row.month}`] ?? 30),
        adtv:  Math.floor(row.count / (monthDays[`${row.fy}_${row.month}`] ?? 30)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  const latestFY = fyList.at(-1) ?? ''
  const latestFYMonths = useMemo(() => new Set(monthly.filter(m => m.fy === latestFY).map(m => m.cal_month)), [monthly, latestFY])
  const ytdLabel = useMemo(() => {
    const c = monthly.filter(m => m.fy === latestFY)
    return c.length ? `${c[0].month_str} – ${c.at(-1)!.month_str}` : latestFY
  }, [monthly, latestFY])

  // ── YTD vs Full ──
  const compData = useMemo(() => {
    const m: Record<string, { fy: string; ytd_amt: number; full_amt: number | null; ytd_pcu: number; full_pcu: number | null; ytd_cnt: number; full_cnt: number | null }> = {}
    for (const r of filtered) {
      if (!m[r.fy]) m[r.fy] = { fy: r.fy, ytd_amt: 0, full_amt: 0, ytd_pcu: 0, full_pcu: 0, ytd_cnt: 0, full_cnt: 0 }
      const cm = new Date(r.month).getMonth() + 1
      if (latestFYMonths.has(cm)) {
        m[r.fy].ytd_amt += r.total_amount
        m[r.fy].ytd_pcu += r.total_pcu
        m[r.fy].ytd_cnt += r.total_count
      }
      m[r.fy].full_amt = (m[r.fy].full_amt ?? 0) + r.total_amount
      m[r.fy].full_pcu = (m[r.fy].full_pcu ?? 0) + r.total_pcu
      m[r.fy].full_cnt = (m[r.fy].full_cnt ?? 0) + r.total_count
    }
    if (m[latestFY]) { m[latestFY].full_amt = null; m[latestFY].full_pcu = null; m[latestFY].full_cnt = null }
    return Object.values(m).sort((a, b) => fySort(a.fy, b.fy))
  }, [filtered, latestFY, latestFYMonths])

  const fyWithDaily = fyData.map(r => ({
    ...r,
    adrr:  r.days > 0 ? r.amount / r.days : 0,
    adpcu: r.days > 0 ? r.pcu    / r.days : 0,
    adtv:  r.days > 0 ? Math.floor(r.count / r.days) : 0,
  }))

  const currFY = fyWithDaily.find(r => r.fy === latestFY)

  // ── Scale ──
  const safeScale = (vals: number[], notation: Notation, isCount = false) =>
    vals.length && vals.some(v => v > 0)
      ? scaleSeries(vals, notation, isCount)
      : { scaled: vals, label: '', yTitle: '' }

  const { scaled: revSc,   label: revLbl,   yTitle: revTitle  } = safeScale(compData.map(r => r.ytd_amt), notation)
  const { scaled: trafSc,  label: trafLbl,  yTitle: trafTitle } = safeScale(compData.map(r => usePCU ? r.ytd_pcu : r.ytd_cnt ?? 0), notation, true)
  const { scaled: adrrSc,  label: adrrLbl,  yTitle: adrrTitle } = safeScale(fyWithDaily.map(r => r.adrr), notation)
  const { scaled: adSc,    label: adLbl,    yTitle: adTitle   } = safeScale(fyWithDaily.map(r => usePCU ? r.adpcu : r.adtv), notation, true)
  const { scaled: mRevSc,  label: mRevLbl,  yTitle: mRevTitle } = safeScale(monthly.map(r => r.adrr), notation)
  const { scaled: mTrafSc, label: mTrafLbl, yTitle: mTrafTitle} = safeScale(monthly.map(r => usePCU ? r.adpcu : r.adtv), notation, true)

  const revDiv  = DIVISORS[revLbl]  ?? 1
  const trafDiv = DIVISORS[trafLbl] ?? 1

  const ytdRevData  = compData.map((r, i) => ({ fy: r.fy, YTD: revSc[i],  'Full Year': r.full_amt != null ? +(r.full_amt  / revDiv ).toFixed(2) : null }))
  const ytdTrafData = compData.map((r, i) => ({ fy: r.fy, YTD: trafSc[i], 'Full Year': (usePCU ? r.full_pcu : r.full_cnt) != null ? +((usePCU ? r.full_pcu! : r.full_cnt!) / trafDiv).toFixed(2) : null }))

  const fysInMonthly = [...new Set(monthly.map(m => m.fy))].sort(fySort)
  const mRevChart  = MONTH_ORDER.map(m => { const e: Record<string, string | number | null> = { month: MONTH_ABBR[m] }; for (const fy of fysInMonthly) { const rows = monthly.filter(r => r.fy === fy && r.cal_month === m); e[fy] = rows.length ? mRevSc[monthly.indexOf(rows[0])] ?? null : null }; return e })
  const mTrafChart = MONTH_ORDER.map(m => { const e: Record<string, string | number | null> = { month: MONTH_ABBR[m] }; for (const fy of fysInMonthly) { const rows = monthly.filter(r => r.fy === fy && r.cal_month === m); e[fy] = rows.length ? mTrafSc[monthly.indexOf(rows[0])] ?? null : null }; return e })

  // Continuous chart data — chronological x-axis
  const mRevContChart  = monthly.map((r, i) => ({ month: r.month_str, ADRR:  mRevSc[i]  ?? null }))
  const mTrafContChart = monthly.map((r, i) => ({ month: r.month_str, [usePCU ? 'ADPCU' : 'ADTV']: mTrafSc[i] ?? null }))

  if (loading) return <PageWrap><EmptyState message="Loading data…" /></PageWrap>
  if (error)   return <PageWrap><EmptyState message={`Error: ${error}`} /></PageWrap>

  const commonNote = compareMode === 'common'
    ? `${commonPlazas.size} common plazas across ${fyList[0]} → ${fyList.at(-1)}`
    : null

  return (
    <PageWrap>
      <PageHeader
        title="Dashboard"
        subtitle="Network overview — revenue, traffic and average daily metrics"
      >
        <NotationToggle value={notation} onChange={setNotation} />
      </PageHeader>

      {/* Filters */}
      <FilterRow>
        <FilterSelect
          label="Concessionaire" value={concessionaire} onChange={handleConcessionaireChange} width={200}
          options={[
            { value: 'All', label: 'All Concessionaires' },
            ...concessionaires.map(c => ({ value: c, label: c }))
          ]}
        />
        <FilterSelect
          label="SPV / Project" value={spv} onChange={handleSpvChange} width={180}
          options={[
            { value: 'All', label: concessionaire === 'All' ? 'All SPVs' : `All (${concessionaire})` },
            ...spvOptions.map(s => ({ value: s, label: s }))
          ]}
        />
        <FilterSelect
          label="Plaza" value={plaza} onChange={setPlaza} width={220}
          options={[
            { value: 'All', label: 'All Plazas' },
            ...filteredPlazas.map(p => ({ value: p, label: p }))
          ]}
        />
        <FilterSelect
          label="Traffic Metric" value={metricMode} onChange={v => setMetricMode(v as 'PCU' | 'Traffic')} width={140}
          options={[{ value: 'PCU', label: 'PCU' }, { value: 'Traffic', label: 'Vehicle Count' }]}
        />
        {/* Compare mode toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={filterLblStyle}>Comparison</label>
          <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden' }}>
            {([['all', 'All Plazas'], ['common', 'Common Plazas']] as [string, string][]).map(([val, lbl]) => (
              <button key={val} onClick={() => setCompareMode(val as 'all' | 'common')} style={{
                padding: '5px 12px', fontSize: 11, fontFamily: 'DM Sans',
                background: compareMode === val ? '#1a2540' : '#fff',
                color: compareMode === val ? '#fff' : '#8995a8',
                border: 'none', cursor: 'pointer', fontWeight: compareMode === val ? 600 : 400,
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </FilterRow>

      {/* Common plazas note */}
      {commonNote && (
        <div style={{ fontSize: 11, color: '#1a7a5e', background: '#e8f7f2', border: '1px solid #b8e8d8', borderRadius: 4, padding: '6px 12px', marginBottom: 14, display: 'inline-block' }}>
          ✓ Apples-to-apples — {commonNote}
        </div>
      )}

      {/* KPIs */}
      {currFY && (
        <>
          <div style={{ fontSize: 10, color: '#a0aabc', marginBottom: 8, letterSpacing: '0.03em' }}>
            {latestFY} — <span style={{ color: '#8995a8' }}>{ytdLabel}</span>
            {plazaCountByFY[latestFY] && <span style={{ marginLeft: 10, color: '#b0bac8' }}>· {plazaCountByFY[latestFY]} plazas</span>}
          </div>
          <KPIStrip>
            <KPICard accent label="Total Revenue"   value={fmtNum(currFY.amount, notation)} />
            <KPICard label="Total Vehicles"  value={fmtNum(currFY.count, notation, true)} />
            <KPICard label={usePCU ? 'Total PCU' : 'Total Traffic'} value={fmtNum(usePCU ? currFY.pcu : currFY.count, notation, true)} />
            <KPICard label="ADRR"            value={fmtNum(currFY.adrr, notation)} unit="/ day" />
            <KPICard label={usePCU ? 'ADPCU' : 'ADTV'} value={fmtNum(usePCU ? currFY.adpcu : currFY.adtv, notation, true)} unit="/ day" />
          </KPIStrip>
        </>
      )}

      {/* YTD vs Full Year */}
      <SectionCard title={`YTD vs Full Year  ·  ${ytdLabel}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <ChartLabel>Revenue ({revTitle})</ChartLabel>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ytdRevData} barGap={3} barCategoryGap="35%" margin={{ bottom: 28 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
                <XAxis dataKey="fy" tick={(props) => <FYTick {...props} plazaCounts={plazaCountByFY} />} axisLine={false} tickLine={false} interval={0} height={44} />
                <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, revLbl)} width={72} />
                <Tooltip content={<ChartTooltip unit={revLbl} />} cursor={{ fill: '#f4f6f9' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                <Bar dataKey="YTD" radius={[2, 2, 0, 0]}>
                  {compData.map(r => <Cell key={r.fy} fill={r.fy === latestFY ? '#e07b10' : '#3d7ab5'} />)}
                </Bar>
                <Bar dataKey="Full Year" radius={[2, 2, 0, 0]} fill="#dde2ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <ChartLabel>{usePCU ? 'PCU Traffic' : 'Vehicle Count'} ({trafTitle})</ChartLabel>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ytdTrafData} barGap={3} barCategoryGap="35%" margin={{ bottom: 28 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
                <XAxis dataKey="fy" tick={(props) => <FYTick {...props} plazaCounts={plazaCountByFY} />} axisLine={false} tickLine={false} interval={0} height={44} />
                <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, trafLbl)} width={72} />
                <Tooltip content={<ChartTooltip unit={trafLbl} />} cursor={{ fill: '#f4f6f9' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                <Bar dataKey="YTD" radius={[2, 2, 0, 0]}>
                  {compData.map(r => <Cell key={r.fy} fill={r.fy === latestFY ? '#e07b10' : '#3d7ab5'} />)}
                </Bar>
                <Bar dataKey="Full Year" radius={[2, 2, 0, 0]} fill="#dde2ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>

      {/* ADRR / AD */}
      <SectionCard title="Average Daily Metrics by Financial Year">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <ChartLabel>ADRR — Avg Daily Revenue ({adrrTitle})</ChartLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fyWithDaily.map((r, i) => ({ fy: r.fy, ADRR: adrrSc[i] }))} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
                <XAxis dataKey="fy" tick={xStyle} axisLine={false} tickLine={false} tickFormatter={v => v.replace('FY ', '')} />
                <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, adrrLbl)} width={72} />
                <Tooltip content={<ChartTooltip unit={adrrLbl} />} cursor={{ fill: '#f4f6f9' }} />
                <Bar dataKey="ADRR" radius={[2, 2, 0, 0]}>
                  {fyWithDaily.map(r => <Cell key={r.fy} fill={r.fy === latestFY ? '#e07b10' : '#3d7ab5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <ChartLabel>{usePCU ? 'ADPCU' : 'ADTV'} — Avg Daily {usePCU ? 'PCU' : 'Traffic'} ({adTitle})</ChartLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fyWithDaily.map((r, i) => ({ fy: r.fy, AD: adSc[i] }))} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
                <XAxis dataKey="fy" tick={xStyle} axisLine={false} tickLine={false} tickFormatter={v => v.replace('FY ', '')} />
                <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, adLbl)} width={72} />
                <Tooltip content={<ChartTooltip unit={adLbl} />} cursor={{ fill: '#f4f6f9' }} />
                <Bar dataKey="AD" name={usePCU ? 'ADPCU' : 'ADTV'} radius={[2, 2, 0, 0]}>
                  {fyWithDaily.map(r => <Cell key={r.fy} fill={r.fy === latestFY ? '#e07b10' : '#3d7ab5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>

      {/* Monthly trends */}
      {/* Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ display: 'flex', border: '1px solid #dde2ea', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
          {([['fy', 'By Financial Year'], ['continuous', 'Continuous']] as [string, string][]).map(([val, lbl]) => (
            <button key={val} onClick={() => setTrendView(val as 'fy' | 'continuous')} style={{
              padding: '5px 14px', background: trendView === val ? '#1a2540' : '#fff',
              color: trendView === val ? '#fff' : '#8995a8',
              border: 'none', cursor: 'pointer', fontFamily: 'DM Sans',
              fontSize: 11, fontWeight: trendView === val ? 600 : 400,
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      <SectionCard title={`Monthly ADRR Trend  ·  Avg Daily Revenue  ·  ${mRevTitle}`}>
        <ResponsiveContainer width="100%" height={260}>
          {trendView === 'fy' ? (
            <LineChart data={mRevChart}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
              <XAxis dataKey="month" tick={xStyle} axisLine={false} tickLine={false} />
              <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, mRevLbl)} width={72} />
              <Tooltip content={<ChartTooltip unit={mRevLbl} />} cursor={{ stroke: '#dde2ea' }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
              {fysInMonthly.map((fy, i) => (
                <Line key={fy} type="monotone" dataKey={fy}
                  stroke={CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)]}
                  strokeWidth={fy === latestFY ? 2.5 : 1.5}
                  dot={false} connectNulls={false}
                  strokeOpacity={fy === latestFY ? 1 : 0.65}
                />
              ))}
            </LineChart>
          ) : (
            <LineChart data={mRevContChart}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
              <XAxis dataKey="month" tick={xStyle} axisLine={false} tickLine={false} interval={Math.floor(mRevContChart.length / 12)} />
              <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, mRevLbl)} width={72} />
              <Tooltip content={<ChartTooltip unit={mRevLbl} />} cursor={{ stroke: '#dde2ea' }} />
              <Line type="monotone" dataKey="ADRR" name="ADRR"
                stroke="#e07b10" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title={`Monthly ${usePCU ? 'ADPCU' : 'ADTV'} Trend  ·  Avg Daily ${usePCU ? 'PCU' : 'Traffic'}  ·  ${mTrafTitle}`}>
        <ResponsiveContainer width="100%" height={260}>
          {trendView === 'fy' ? (
            <LineChart data={mTrafChart}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
              <XAxis dataKey="month" tick={xStyle} axisLine={false} tickLine={false} />
              <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, mTrafLbl)} width={72} />
              <Tooltip content={<ChartTooltip unit={mTrafLbl} />} cursor={{ stroke: '#dde2ea' }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
              {fysInMonthly.map((fy, i) => (
                <Line key={fy} type="monotone" dataKey={fy}
                  stroke={CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)]}
                  strokeWidth={fy === latestFY ? 2.5 : 1.5}
                  dot={false} connectNulls={false}
                  strokeOpacity={fy === latestFY ? 1 : 0.65}
                />
              ))}
            </LineChart>
          ) : (
            <LineChart data={mTrafContChart}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf2" vertical={false} />
              <XAxis dataKey="month" tick={xStyle} axisLine={false} tickLine={false} interval={Math.floor(mTrafContChart.length / 12)} />
              <YAxis tick={yStyle} axisLine={false} tickLine={false} tickFormatter={v => fmtTick(v, mTrafLbl)} width={72} />
              <Tooltip content={<ChartTooltip unit={mTrafLbl} />} cursor={{ stroke: '#dde2ea' }} />
              <Line type="monotone" dataKey={usePCU ? 'ADPCU' : 'ADTV'} name={usePCU ? 'ADPCU' : 'ADTV'}
                stroke="#3d7ab5" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </SectionCard>
    </PageWrap>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function PageWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '28px 32px', maxWidth: 1400 }}>{children}</div>
}

function ChartLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#8995a8', marginBottom: 10, fontFamily: 'DM Sans' }}>{children}</div>
}

const filterLblStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#a0aabc',
  textTransform: 'uppercase', letterSpacing: '0.07em',
}
