import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface StateMonthRow {
  state: string
  fy: string
  month: string          // 'YYYY-MM-DD'
  days_in_month: number
  plazas: number
  total_amount: number
}

// One row per state / financial year / month (roughly 30 states x 55 months).
// Pages through the result so the 1000-row API limit never truncates it.
export function useStateSummary() {
  const [data, setData]       = useState<StateMonthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const all: StateMonthRow[] = []
        const PAGE = 1000
        for (let from = 0; ; from += PAGE) {
          const { data: rows, error: err } = await supabase
            .rpc('get_state_month_summary')
            .range(from, from + PAGE - 1)
          if (err) throw new Error(err.message)
          const batch = (rows ?? []) as StateMonthRow[]
          all.push(...batch)
          if (batch.length < PAGE) break
        }
        if (!cancelled) setData(all.map(r => ({ ...r, total_amount: Number(r.total_amount), plazas: Number(r.plazas) })))
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
