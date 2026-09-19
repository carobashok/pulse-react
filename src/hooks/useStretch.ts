import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface StretchRow {
  plaza_name:    string
  month_date:    string   // "2024-09-01"
  vehicle_type:  string
  total_pcu:     number
  total_count:   number
  days_in_month: number
  adt_pcu:       number
  adt_count:     number
}

export function useStretch(plazas: string[], months: number) {
  const [data, setData]       = useState<StretchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!plazas.length) { setData([]); return }
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const { data: rows, error: err } = await supabase.rpc('get_stretch_data', {
          p_plazas: plazas,
          p_months: months,
        })
        if (err) throw new Error(err.message)
        if (!cancelled) setData((rows ?? []) as StretchRow[])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [plazas.join(','), months])

  return { data, loading, error }
}
