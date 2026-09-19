import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface CAGRRow {
  plaza_name: string
  piu: string
  ro: string
  fy: string          // e.g. "FY 2024-25" — already formatted string from DB
  month: string       // ISO date string: "2024-04-01"
  month_name: string
  fy_month_ord: number
  days_in_month: number
  total_amount: number
  total_pcu: number
  total_count: number
  months_data: number
}

export function useCAGR() {
  const [data, setData] = useState<CAGRRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const { data: rows, error: err } = await supabase
          .from('monthly_plaza_summary')
          .select('plaza_name,piu,ro,fy,month,month_name,fy_month_ord,days_in_month,total_amount,total_pcu,total_count,months_data')
          .order('plaza_name')
          .order('fy')
          .order('fy_month_ord')

        if (err) throw new Error(err.message)
        if (!cancelled) setData((rows ?? []) as CAGRRow[])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
