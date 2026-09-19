import React, { useMemo, useState } from 'react'
import { usePlazaList } from '../hooks/usePlazaList'
import { useSCF } from '../hooks/useSCF'
import { MONTH_ORDER, MONTH_ABBR } from '../lib/formatters'
import { PageHeader, FilterRow, FilterSelect, SectionCard, EmptyState } from '../components/UI'

type VehKey = 'ALL'|'CAR_JEEP'|'LCV'|'BUS_TRUCK'|'3_AXLE'|'4_6_AXLE'|'OSV'

const VEH_OPTIONS = [
  {value:'ALL',      label:'Total (All Classes)'},
  {value:'CAR_JEEP', label:'Car / Jeep'},
  {value:'LCV',      label:'LCV'},
  {value:'BUS_TRUCK',label:'Bus / Truck'},
  {value:'3_AXLE',   label:'3-Axle'},
  {value:'4_6_AXLE', label:'4-6 Axle'},
  {value:'OSV',      label:'OSV'},
]

function scfBand(val: number | null): { color: string; bg: string } {
  if (val === null) return { color:'#b0bac8', bg:'transparent' }
  if (val < 0.85)  return { color:'#18977a', bg:'#18977a12' }
  if (val < 0.95)  return { color:'#2aa87e', bg:'#2aa87e0e' }
  if (val < 1.05)  return { color:'#8995a8', bg:'transparent' }
  if (val < 1.15)  return { color:'#d97706', bg:'#d9770610' }
  return               { color:'#c94f4f', bg:'#c94f4f12' }
}

function PivotTable({
  rowKeys, colKeys, data, fmtCell, colorCell, aadtCol
}: {
  rowKeys: string[]
  colKeys: string[]
  data: Record<string, Record<string, number | null>>
  fmtCell: (v: number | null) => string
  colorCell?: (v: number | null) => { color: string; bg: string }
  aadtCol?: Record<string, number | null>
}) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border-lt)' }}>
            <th style={thS('left')}>Financial Year</th>
            {colKeys.map(c=><th key={c} style={thS('right')}>{c}</th>)}
            {aadtCol && <th style={{ ...thS('right'), color:'#e07b10' }}>AADT</th>}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((fy,ri)=>(
            <tr key={fy} style={{ background: ri%2===0 ? 'var(--surface)' : 'var(--surface2, #f8f9fb)', borderBottom:'1px solid var(--border)' }}>
              <td style={{ ...tdS('left'), color:'#1a2540', fontFamily:'var(--font)', fontWeight:500 }}>{fy}</td>
              {colKeys.map(col=>{
                const v = data[fy]?.[col] ?? null
                const style = colorCell ? colorCell(v) : { color:'#1a2540', bg:'transparent' }
                return (
                  <td key={col} style={{ ...tdS('right'), color:style.color, background:style.bg }}>
                    {v !== null ? fmtCell(v) : <span style={{color:'#b0bac8'}}>—</span>}
                  </td>
                )
              })}
              {aadtCol && (
                <td style={{ ...tdS('right'), color:'#e07b10', fontWeight:600 }}>
                  {aadtCol[fy] != null ? Math.round(aadtCol[fy]!).toLocaleString('en-IN') : <span style={{color:'#b0bac8'}}>—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function thS(align: 'left'|'right'): React.CSSProperties {
  return { padding:'9px 14px', textAlign:align, color:'#b0bac8', fontWeight:600, fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap', background:'var(--surface2, #f8f9fb)', fontFamily:'var(--font)' }
}
function tdS(align: 'left'|'right'): React.CSSProperties {
  return { padding:'8px 14px', textAlign:align, fontFamily:'var(--mono)', whiteSpace:'nowrap' }
}

export default function SCFPage() {
  const { plazas, loading: plLoading } = usePlazaList()
  const [selectedPlaza, setSelectedPlaza] = useState('')
  const [selVeh,        setSelVeh]        = useState<VehKey>('ALL')
  const [metricMode,    setMetricMode]    = useState<'PCU'|'Traffic'>('PCU')

  const { data: rawData, loading, error } = useSCF(selectedPlaza)

  const usePCU      = metricMode === 'PCU'
  const metricCol   = usePCU ? 'adt_pcu'   : 'adt_count'
  const totalCol    = usePCU ? 'total_pcu' : 'total_count'
  const metricLabel = usePCU ? 'PCU'       : 'Vehicles'

  const vehData = useMemo(() => {
    if (!rawData.length) return []
    if (selVeh === 'ALL') {
      const g: Record<string, typeof rawData[0]> = {}
      for (const r of rawData) {
        const key = `${r.month_date}_${r.fy}`
        if (!g[key]) g[key] = { ...r, total_pcu:0, total_count:0, adt_pcu:0, adt_count:0 }
        g[key].total_pcu   += r.total_pcu
        g[key].total_count += r.total_count
      }
      return Object.values(g).map(r=>({ ...r, adt_pcu:r.total_pcu/r.days_in_month, adt_count:r.total_count/r.days_in_month }))
    }
    return rawData.filter(r=>r.vehicle_type===selVeh)
  }, [rawData, selVeh])

  const fyMonthCount = useMemo(() => {
    const c: Record<number, Set<number>> = {}
    for (const r of vehData) { if (!c[r.fy]) c[r.fy]=new Set(); c[r.fy].add(r.cal_month) }
    return c
  }, [vehData])

  const allFYs      = Object.keys(fyMonthCount).map(Number).sort()
  const completeFYs = allFYs.filter(fy=>fyMonthCount[fy].size===12)
  const monthCols   = MONTH_ORDER.map(m=>MONTH_ABBR[m])

  const fyLabel = (fy: number) => `FY ${fy}-${String(fy+1).slice(-2)}`

  // ADT pivot
  const adtData: Record<string, Record<string, number|null>> = {}
  const aadtByFY: Record<string, number|null> = {}

  for (const fy of allFYs) {
    const lbl = fyLabel(fy)
    adtData[lbl] = {}
    for (const m of MONTH_ORDER) {
      const row = vehData.find(r=>r.fy===fy&&r.cal_month===m)
      adtData[lbl][MONTH_ABBR[m]] = row ? (metricCol === 'adt_pcu' ? row.adt_pcu : row.adt_count) : null
    }
    if (completeFYs.includes(fy)) {
      const total = vehData.filter(r=>r.fy===fy).reduce((s,r)=> s + (totalCol === 'total_pcu' ? r.total_pcu : r.total_count), 0)
      aadtByFY[lbl] = Math.round(total/365)
    } else {
      aadtByFY[lbl] = null
    }
  }

  // SCF pivot
  const scfData: Record<string, Record<string, number|null>> = {}
  for (const fy of completeFYs) {
    const lbl  = fyLabel(fy)
    const aadt = aadtByFY[lbl]
    scfData[lbl] = {}
    for (const m of MONTH_ORDER) {
      const row = vehData.find(r=>r.fy===fy&&r.cal_month===m)
      const val = row ? (metricCol === 'adt_pcu' ? row.adt_pcu : row.adt_count) : 0
      if (row && aadt && val > 0) {
        scfData[lbl][MONTH_ABBR[m]] = +(aadt / val).toFixed(4)
      } else {
        scfData[lbl][MONTH_ABBR[m]] = null
      }
    }
  }

  const adtFYLabels = allFYs.map(fyLabel)
  const scfFYLabels = completeFYs.map(fyLabel)

  return (
    <div style={{ padding:'28px 32px', maxWidth:1400 }}>
      <PageHeader
        title="ADT & SCF Analysis"
        subtitle="Average Daily Traffic and Seasonal Correction Factors — complete financial years only"
      />

      <FilterRow>
        <FilterSelect
          label="Plaza" value={selectedPlaza} onChange={setSelectedPlaza} width={280}
          options={[{value:'',label:'— Select a plaza —'},...(plLoading?[]:(plazas.map(p=>({value:p,label:p}))))]}
        />
        <FilterSelect
          label="Vehicle Class" value={selVeh} onChange={v=>setSelVeh(v as VehKey)} width={180}
          options={VEH_OPTIONS}
        />
        <FilterSelect
          label="Metric" value={metricMode} onChange={v=>setMetricMode(v as 'PCU'|'Traffic')} width={140}
          options={[{value:'PCU',label:'PCU'},{value:'Traffic',label:'Vehicle Count'}]}
        />
      </FilterRow>

      {!selectedPlaza && <EmptyState message="Select a plaza to view ADT and SCF analysis" />}
      {selectedPlaza && loading && <EmptyState message={`Loading data for ${selectedPlaza}…`} />}
      {selectedPlaza && error   && <EmptyState message={`Error: ${error}`} />}

      {selectedPlaza && !loading && vehData.length===0 && (
        <EmptyState message={`No data found for ${selectedPlaza}`} />
      )}

      {selectedPlaza && !loading && vehData.length>0 && (
        <>
          {/* Complete FY badges */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'#b0bac8', letterSpacing:'0.04em' }}>COMPLETE FINANCIAL YEARS</span>
            {completeFYs.length===0
              ? <span style={{ fontSize:11, color:'#c94f4f', fontFamily:'var(--mono)' }}>None — SCF unavailable</span>
              : completeFYs.map(fy=>(
                  <span key={fy} style={{ fontSize:11, color:'#16a085', fontFamily:'var(--mono)', background:'#18977a12', padding:'2px 8px', borderRadius:'var(--radius)', border:'1px solid #18977a30' }}>
                    {fyLabel(fy)}
                  </span>
                ))
            }
          </div>

          {/* ADT Table */}
          <SectionCard
            title={`Average Daily Traffic (ADT) — ${metricLabel}`}
            subtitle="All financial years including partial · AADT for complete FYs only"
            flush
          >
            <PivotTable
              rowKeys={adtFYLabels}
              colKeys={monthCols}
              data={adtData}
              fmtCell={v=>v!=null?Math.round(v).toLocaleString('en-IN'):'—'}
              aadtCol={aadtByFY}
            />
          </SectionCard>

          {/* SCF Table */}
          <SectionCard
            title="Seasonal Correction Factor (SCF = AADT ÷ ADT)"
            subtitle={`${metricLabel} · Complete FYs only · < 1 peak month · > 1 lean month`}
            flush
          >
            {/* Legend */}
            <div style={{ display:'flex', gap:20, padding:'10px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
              {[
                { label:'< 0.85  Peak',        color:'#18977a' },
                { label:'0.85–0.95  Near-peak', color:'#2aa87e' },
                { label:'0.95–1.05  Average',   color:'#8995a8' },
                { label:'1.05–1.15  Lean',      color:'#d97706' },
                { label:'> 1.15  Very lean',    color:'#c94f4f' },
              ].map(b=>(
                <div key={b.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#8995a8' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:b.color, flexShrink:0 }} />
                  {b.label}
                </div>
              ))}
            </div>

            {scfFYLabels.length===0
              ? <div style={{padding:'20px'}}><EmptyState message="No complete financial years — SCF cannot be computed" /></div>
              : <PivotTable
                  rowKeys={scfFYLabels}
                  colKeys={monthCols}
                  data={scfData}
                  fmtCell={v=>v!=null?v.toFixed(4):'—'}
                  colorCell={scfBand}
                />
            }
          </SectionCard>
        </>
      )}
    </div>
  )
}
