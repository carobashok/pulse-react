import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface SCFRow {
  month_date: string   // "2024-04-01"
  fy: number
  cal_month: number    // 1–12
  days_in_month: number
  vehicle_type: string
  total_pcu: number
  total_count: number
  adt_pcu: number
  adt_count: number
}

export function useSCF(plazaName: string) {
  const [data, setData] = useState<SCFRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plazaName) { setData([]); return }
    let cancelled = false
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        // Call the Postgres RPC that mirrors load_forecast_data()
        // Falls back to direct query if RPC not set up
        const { data: rows, error: err } = await supabase.rpc('get_scf_data', {
          p_plaza: plazaName,
        })

        if (err) {
          // Fallback: raw query via toll_data (slower but works without RPC)
          const { data: raw, error: rawErr } = await supabase
            .from('toll_data')
            .select('date,vehicle_type,count,amount,pcu_traffic')
            .ilike('plaza_name', plazaName.trim())

          if (rawErr) throw new Error(rawErr.message)

          // Aggregate client-side: group by month + vehicle_type
          const grouped: Record<string, SCFRow> = {}
          for (const r of raw ?? []) {
            const d = new Date(r.date)
            const y = d.getFullYear()
            const m = d.getMonth() + 1
            const fy = m >= 4 ? y : y - 1
            const monthDate = `${d.getFullYear()}-${String(m).padStart(2, '0')}-01`
            const daysInMonth = new Date(y, m, 0).getDate()
            const key = `${monthDate}_${r.vehicle_type}`
            if (!grouped[key]) {
              grouped[key] = {
                month_date: monthDate,
                fy,
                cal_month: m,
                days_in_month: daysInMonth,
                vehicle_type: r.vehicle_type,
                total_pcu: 0,
                total_count: 0,
                adt_pcu: 0,
                adt_count: 0,
              }
            }
            grouped[key].total_pcu   += r.pcu_traffic ?? 0
            grouped[key].total_count += r.count ?? 0
          }
          const agg = Object.values(grouped).map(g => ({
            ...g,
            adt_pcu:   g.total_pcu   / g.days_in_month,
            adt_count: g.total_count / g.days_in_month,
          }))
          if (!cancelled) setData(agg)
        } else {
          if (!cancelled) setData((rows ?? []) as SCFRow[])
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [plazaName])

  return { data, loading, error }
}
